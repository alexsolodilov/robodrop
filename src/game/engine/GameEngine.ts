import * as PIXI from 'pixi.js';
import { Robot } from './Robot';
import { Slope } from './Slope';
import { Background } from './Background';
import { Effects } from './Effects';
import { Camera } from './Camera';
import { Kicker } from './Kicker';
import { RobotWheel } from './RobotWheel';
import { stateGame } from '../stateGame.svelte';
import {
	SLOW_MOTION_FACTOR,
	GAME_WIDTH,
	GAME_HEIGHT,
	KR_GRAVITY,
	KR_AIR_DRAG,
	KR_TICK_RATE,
	LIMB_FADE_RATE,
	LANDING_ANGLES,
} from '../constants';
import type {
	BookEventGameStart,
	BookEventKick,
	BookEventBounce,
	BookEventHeadCatapult,
} from '../typesBookEvent';

const VEL_SCALE = 30;
const ROBOT_OFFSET_Y = -30;

export class GameEngine {
	public app: PIXI.Application;
	private gameContainer: PIXI.Container;
	private worldContainer: PIXI.Container;

	private robot: Robot | null = null;
	private slope: Slope | null = null;
	private background: Background | null = null;
	private effects: Effects | null = null;
	private camera: Camera;
	private kicker: Kicker | null = null;
	private robotWheel: RobotWheel | null = null;

	private slowMotionTimer = 0;
	private slowMotionFactor = 1;

	// --- Analytical trajectory state ---
	private physicsActive = false;
	private arcStartX = 0;
	private arcStartY = 0;
	private arcVx = 0;
	private arcVy = 0;
	private flightElapsed = 0;
	private flightDuration = 1;
	private flightStartRotation = 0;
	private completedSpins = 0;
	private targetSpinCount = 0;
	private targetLandingAngle = 0;
	private robotAngularVel = 0;
	private bounceResolve: (() => void) | null = null;
	private pendingLandingType: string | null = null;

	// Head catapult — also analytical
	private headContainer: PIXI.Container | null = null;
	private headPhysicsActive = false;
	private headArcStartX = 0;
	private headArcStartY = 0;
	private headArcVx = 0;
	private headArcVy = 0;
	private headFlightElapsed = 0;
	private headFlightDuration = 1;
	private headAngularVel = 0;
	private headResolve: (() => void) | null = null;

	// Detached limbs
	private detachedLimbs: {
		container: PIXI.Container;
		vx: number; vy: number; rotSpeed: number;
	}[] = [];

	constructor() {
		this.app = new PIXI.Application();
		this.gameContainer = new PIXI.Container();
		this.worldContainer = new PIXI.Container();
		this.camera = new Camera(GAME_WIDTH, GAME_HEIGHT);
	}

	async init(canvas: HTMLCanvasElement): Promise<void> {
		await this.app.init({
			canvas,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			backgroundColor: 0x0a0a2e,
			antialias: true,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true,
		});

		this.gameContainer.addChild(this.worldContainer);
		this.app.stage.addChild(this.gameContainer);

		this.background = new Background(this.worldContainer);
		this.slope = new Slope(this.worldContainer);
		this.effects = new Effects(this.worldContainer);

		// Kicker mechanism at top of slope
		const kickerY = this.slope.getSlopeYAtX(40);
		this.kicker = new Kicker(this.worldContainer, 40, kickerY - 35);

		// Robot selection wheel above kicker
		this.robotWheel = new RobotWheel(this.worldContainer, -30, kickerY - 100);

		this.app.ticker.add(this.animate);
	}

	// -------------------------------------------------------------------
	// Main loop
	// -------------------------------------------------------------------
	private animate = (ticker: PIXI.Ticker): void => {
		let dt = ticker.deltaMS / 1000;

		// Slow motion
		if (this.slowMotionTimer > 0) {
			this.slowMotionTimer -= dt;
			dt *= this.slowMotionFactor;
			if (this.slowMotionTimer <= 0) this.slowMotionFactor = 1;
		}
		dt *= stateGame.speed || 1;

		// Clamp dt to avoid huge jumps on tab switch
		dt = Math.min(dt, 0.05);

		this.updatePhysics(dt);
		this.updateHeadPhysics(dt);
		this.updateDetachedLimbs(dt);
		if (this.effects) this.effects.update(dt);

		// Camera follow
		if (this.headPhysicsActive && this.headContainer) {
			const hx = this.headContainer.position.x;
			const hy = this.headContainer.position.y;
			const slopeY = this.slope ? this.slope.getSlopeYAtX(hx) : hy;
			this.camera.followTarget(hx, hy, slopeY);
		} else if (this.robot) {
			const slopeY = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;
			this.camera.followTarget(this.robot.x, this.robot.y, slopeY);
		}

		this.camera.update(dt);
		this.camera.applyToContainer(this.worldContainer);
		if (this.background) this.background.update(this.camera.x);

		// Trail particles while flying
		if (this.robot && this.physicsActive && this.effects) {
			const currentVy = this.arcVy + KR_GRAVITY * this.flightElapsed;
			const speed = Math.sqrt(this.arcVx ** 2 + currentVy ** 2);
			if (speed > 50) {
				this.effects.spawnTrail(this.robot.x, this.robot.y, speed * 0.01);
			}
		}
	};

	// -------------------------------------------------------------------
	// Physics simulation — real gravity + slope collision
	// -------------------------------------------------------------------
	private updatePhysics(dt: number): void {
		if (!this.physicsActive || !this.robot) return;

		this.flightElapsed += dt;
		const t = this.flightElapsed;

		// --- Analytical position (parabolic arc) ---
		this.robot.x = this.arcStartX + this.arcVx * t;
		this.robot.y = this.arcStartY + this.arcVy * t + 0.5 * KR_GRAVITY * t * t;

		// --- Rotation ---
		// Robot must arrive at exactly targetLandingAngle (absolute) at the end of flight,
		// having completed targetSpinCount full rotations along the way.
		{
			const progress = Math.min(1, t / this.flightDuration);
			const easedProgress = easeInOutCubic(progress);

			// Normalize start angle to [0, 2π)
			const startNorm = ((this.flightStartRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
			// Angular delta to reach landing angle (shortest forward path)
			let delta = this.targetLandingAngle - startNorm;
			if (delta < 0) delta += Math.PI * 2;
			// Add full spins
			delta += this.targetSpinCount * Math.PI * 2;

			this.robot.setRotation(this.flightStartRotation + delta * easedProgress);
		}

		this.robot.container.position.set(this.robot.x, this.robot.y);

		// --- Spring joint update ---
		// Compute effective angular velocity for limb swing
		const startNorm2 = ((this.flightStartRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		let delta2 = this.targetLandingAngle - startNorm2;
		if (delta2 < 0) delta2 += Math.PI * 2;
		delta2 += this.targetSpinCount * Math.PI * 2;
		const effectiveAngVel = delta2 / this.flightDuration;

		if (effectiveAngVel > 0.5) {
			this.robot.updateJoints(dt, effectiveAngVel);
		}

		// --- Spin notifications mid-flight ---
		const slopeYHere = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;
		const heightAboveSlope = slopeYHere - this.robot.y;

		if (heightAboveSlope > 60) {
			const totalRotation = Math.abs(this.robot.rotation - this.flightStartRotation);
			const fullSpins = Math.floor(totalRotation / (Math.PI * 2));
			if (fullSpins > this.completedSpins) {
				this.completedSpins = fullSpins;
				if (this.effects && fullSpins <= this.targetSpinCount) {
					const labels = ['', 'SPIN!', 'DOUBLE SPIN!', 'TRIPLE SPIN!', 'QUAD SPIN!'];
					const label = labels[Math.min(fullSpins, 4)] || `${fullSpins}x SPIN!`;
					const colors = [0, 0x44dd44, 0xffdd44, 0xff8800, 0xff2222];
					const color = colors[Math.min(fullSpins, 4)] || 0xff2222;
					const size = 14 + fullSpins * 3;
					this.effects.spawnFloatingText(
						this.robot.x, this.robot.y - 50 - fullSpins * 10,
						label, color, size,
					);
				}
			}
		}

		// --- Landing detection (time-based) ---
		if (t >= this.flightDuration) {
			// Snap to exact landing position
			this.robot.x = this.arcStartX + this.arcVx * this.flightDuration;
			this.robot.y = this.arcStartY + this.arcVy * this.flightDuration
				+ 0.5 * KR_GRAVITY * this.flightDuration * this.flightDuration;

			// Rotation should already be at targetLandingAngle from the eased rotation above,
			// but snap to exact value to remove floating point drift
			if (this.pendingLandingType) {
				this.robot.setRotation(LANDING_ANGLES[this.pendingLandingType] ?? 0);
				this.pendingLandingType = null;
			}

			this.robot.container.position.set(this.robot.x, this.robot.y);
			this.physicsActive = false;

			this.robot.impactJoints(2);

			if (this.bounceResolve) {
				this.bounceResolve();
				this.bounceResolve = null;
			}
		}
	}

	private updateHeadPhysics(dt: number): void {
		if (!this.headPhysicsActive || !this.headContainer) return;

		this.headFlightElapsed += dt;
		const t = this.headFlightElapsed;

		this.headContainer.position.set(
			this.headArcStartX + this.headArcVx * t,
			this.headArcStartY + this.headArcVy * t + 0.5 * KR_GRAVITY * t * t,
		);
		this.headContainer.rotation += this.headAngularVel * dt;

		if (t >= this.headFlightDuration) {
			this.headPhysicsActive = false;
			this.headContainer.position.set(
				this.headArcStartX + this.headArcVx * this.headFlightDuration,
				this.headArcStartY + this.headArcVy * this.headFlightDuration
					+ 0.5 * KR_GRAVITY * this.headFlightDuration * this.headFlightDuration,
			);
			if (this.headResolve) {
				this.headResolve();
				this.headResolve = null;
			}
		}
	}

	private updateDetachedLimbs(dt: number): void {
		for (let i = this.detachedLimbs.length - 1; i >= 0; i--) {
			const limb = this.detachedLimbs[i];

			limb.vy += KR_GRAVITY * dt;

			// Air drag: 0.3% per 30ms tick, frame-rate independent
			const dragFactor = Math.pow(1 - KR_AIR_DRAG, dt * KR_TICK_RATE);
			limb.vx *= dragFactor;
			limb.vy *= dragFactor;

			limb.container.position.x += limb.vx * dt;
			limb.container.position.y += limb.vy * dt;
			limb.container.rotation += limb.rotSpeed * dt;
			limb.container.alpha -= dt * LIMB_FADE_RATE;

			if (limb.container.alpha <= 0) {
				this.worldContainer.removeChild(limb.container);
				limb.container.destroy({ children: true });
				this.detachedLimbs.splice(i, 1);
			}
		}
	}

	// -------------------------------------------------------------------
	// Public API (called from bookEventHandlerMap)
	// -------------------------------------------------------------------

	async setupRound(
		event: BookEventGameStart,
		landingPoints?: { x: number; y: number }[],
	): Promise<void> {
		if (this.robot) this.robot.destroy();

		// Spin the wheel to selected robot
		if (this.robotWheel) {
			this.robotWheel.setVisible(true);
			await this.robotWheel.selectRobot(event.robot);
		}

		// Build terrain from known landing points
		if (this.slope) {
			const startY = 60 * 1.0;
			this.slope.initTerrain(0, startY, event.finishX, landingPoints || []);
		}

		// Create robot at kicker position
		this.robot = new Robot(event.robot, this.worldContainer);
		const startSlopeY = this.slope ? this.slope.getSlopeYAtX(60) : 60;
		this.robot.setPosition(60, startSlopeY + ROBOT_OFFSET_Y);
		this.robot.resetJoints();

		// Camera starts at top of slope
		this.camera.x = -50;
		this.camera.y = startSlopeY - 300;

		this.physicsActive = false;
		this.headPhysicsActive = false;
		this.headContainer = null;
		this.detachedLimbs = [];
	}

	async startKick(event: BookEventKick): Promise<void> {
		if (!this.robot) return;

		if (this.robotWheel) this.robotWheel.setVisible(false);
		if (this.kicker) await this.kicker.kick();

		// For the initial kick, we don't know the landing point yet.
		// Use velocity from event; first waitForBounce will recalculate the arc.
		this.arcStartX = this.robot.x;
		this.arcStartY = this.robot.y;
		this.arcVx = event.initialVx * VEL_SCALE;
		this.arcVy = event.initialVy * VEL_SCALE;
		this.flightDuration = 2.0; // will be corrected by first bounce event

		this.robotAngularVel = event.initialVx * 0.3;
		this.targetSpinCount = 0;
		this.targetLandingAngle = 0;
		this.flightStartRotation = this.robot.rotation;
		this.completedSpins = 0;
		this.flightElapsed = 0;
		this.physicsActive = true;
	}

	async waitForBounce(event: BookEventBounce): Promise<void> {
		if (!this.robot) return;

		this.pendingLandingType = event.landedOn;

		if (!this.physicsActive) return;

		// Compute a NEW arc from current robot position to the landing point.
		// Use event.airTime as total flight for this segment.
		// The robot is already in flight — we set flightElapsed = 0 and compute
		// vx/vy so the parabola starts here and ends at the target.
		const currentX = this.robot.x;
		const currentY = this.robot.y;
		const targetX = event.positionX;
		const targetY = event.slopeY + ROBOT_OFFSET_Y;

		// Use full airTime for the arc (this is the time from launch to landing)
		const totalTime = Math.max(0.5, event.airTime);

		this.arcStartX = currentX;
		this.arcStartY = currentY;
		this.arcVx = (targetX - currentX) / totalTime;
		this.arcVy = (targetY - currentY - 0.5 * KR_GRAVITY * totalTime * totalTime) / totalTime;
		this.flightDuration = totalTime;
		this.flightElapsed = 0;

		this.flightStartRotation = this.robot.rotation;
		this.targetSpinCount = event.spinCount;
		this.targetLandingAngle = LANDING_ANGLES[event.landedOn] ?? 0;
		this.completedSpins = 0;

		return new Promise<void>((resolve) => {
			this.bounceResolve = resolve;
		});
	}

	async launchFromBounce(event: BookEventBounce): Promise<void> {
		if (!this.robot) return;

		const slopeY = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;

		// Spring compression on feet landing
		if (event.landedOn === 'both_feet') {
			this.robot.compressLegs();
		}

		// Landing impact on spring joints
		const impactIntensity = event.landedOn === 'both_feet' ? 1.5 : 3;
		this.robot.impactJoints(impactIntensity);

		// Sparks at impact
		if (this.effects) {
			this.effects.spawnSparks(this.robot.x, slopeY, event.landedOn === 'both_feet');
		}

		// Detach limb visually
		if (event.limbLost) {
			const detached = this.robot.detachLimb(event.limbLost, this.worldContainer);
			if (detached) {
				if (this.effects) this.effects.spawnBolts(this.robot.x, slopeY);
				this.detachedLimbs.push(detached);
			}
		}

		// Loosen limb visually
		if (event.limbLoosened) {
			this.robot.loosenLimb(event.limbLoosened);
		}

		// Floating text for penalties
		if (this.effects && event.penaltyDivisor > 1) {
			this.effects.spawnFloatingText(
				this.robot.x, slopeY - 60,
				`\u00F7${event.penaltyDivisor}`, 0xff4444, 20,
			);
		}

		// Set up analytical arc for the next bounce
		this.arcStartX = this.robot.x;
		this.arcStartY = this.robot.y;
		this.arcVx = event.launchVx * VEL_SCALE;
		this.arcVy = event.launchVy * VEL_SCALE;
		this.flightDuration = Math.max(0.5, event.airTime);

		this.flightStartRotation = this.robot.rotation;
		this.completedSpins = 0;
		this.flightElapsed = 0;
		this.targetSpinCount = event.spinCount;
		// Default landing angle — both_feet (upright). Will be overridden by next waitForBounce.
		this.targetLandingAngle = 0;
		this.robotAngularVel = 0;
		this.physicsActive = true;
	}

	async playCrash(event: BookEventBounce): Promise<void> {
		if (!this.robot) return;

		const slopeY = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;

		// Screen shake
		this.camera.shake(12, 500);

		// Red sparks burst
		if (this.effects) {
			this.effects.spawnSparks(this.robot.x, slopeY, false);
			this.effects.spawnFloatingText(
				this.robot.x, slopeY - 80,
				'CRASH!', 0xff2222, 28,
			);
		}

		// Detach all remaining limbs for dramatic effect
		if (this.robot) {
			for (const limbId of ['left_leg', 'right_leg', 'left_arm', 'right_arm'] as const) {
				const detached = this.robot.detachLimb(limbId, this.worldContainer);
				if (detached) {
					this.detachedLimbs.push(detached);
				}
			}
		}

		// Brief pause so crash is visible
		await new Promise<void>(resolve => setTimeout(resolve, 600));
	}

	async playHeadCatapult(event: BookEventHeadCatapult): Promise<void> {
		if (!this.robot) return;

		const robotX = this.robot.x;
		const robotY = this.robot.y;

		this.robot.detachBody();
		this.headContainer = this.robot.detachHead(this.worldContainer);
		this.headContainer.position.set(robotX, robotY - 10);

		// Compute analytical arc for head
		this.headArcStartX = robotX;
		this.headArcStartY = robotY - 10;
		this.headFlightDuration = event.headAirTime;

		const targetX = event.headLandsAtX;
		const targetY = this.slope ? this.slope.getSlopeYAtX(targetX) : event.slopeY;

		this.headArcVx = (targetX - this.headArcStartX) / this.headFlightDuration;
		this.headArcVy = (targetY - this.headArcStartY - 0.5 * KR_GRAVITY * this.headFlightDuration * this.headFlightDuration) / this.headFlightDuration;
		this.headAngularVel = event.headSpinCount * Math.PI * 2 / event.headAirTime;
		this.headFlightElapsed = 0;
		this.headPhysicsActive = true;

		return new Promise<void>((resolve) => {
			this.headResolve = resolve;
		});
	}

	finalizeTerrain(): void {
		if (this.slope) this.slope.finalize();
	}

	triggerScreenShake(intensity: number): void {
		this.camera.shake(intensity, 300);
	}

	triggerSlowMotion(durationMs: number): void {
		this.slowMotionTimer = durationMs / 1000;
		this.slowMotionFactor = SLOW_MOTION_FACTOR;
	}

	reset(): void {
		this.physicsActive = false;
		this.headPhysicsActive = false;
		this.bounceResolve = null;
		this.headResolve = null;

		if (this.robot) { this.robot.destroy(); this.robot = null; }
		if (this.headContainer) {
			this.worldContainer.removeChild(this.headContainer);
			this.headContainer.destroy({ children: true });
			this.headContainer = null;
		}
		for (const limb of this.detachedLimbs) {
			this.worldContainer.removeChild(limb.container);
			limb.container.destroy({ children: true });
		}
		this.detachedLimbs = [];
		if (this.effects) this.effects.clear();
	}

	resize(width: number, height: number): void {
		if (!this.app.renderer) return;
		this.app.renderer.resize(width, height);
		this.camera.resize(width, height);
	}

	destroy(): void {
		this.app.ticker.remove(this.animate);
		this.reset();
		if (this.background) this.background.destroy();
		if (this.slope) this.slope.destroy();
		if (this.effects) this.effects.destroy();
		if (this.kicker) this.kicker.destroy();
		if (this.robotWheel) this.robotWheel.destroy();
		this.app.destroy(true, { children: true });
	}
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
