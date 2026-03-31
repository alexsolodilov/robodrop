import * as PIXI from 'pixi.js';
import { Robot } from './Robot';
import { Slope } from './Slope';
import { Background } from './Background';
import { Effects } from './Effects';
import { Camera } from './Camera';
import { Kicker } from './Kicker';
import { RobotWheel } from './RobotWheel';
import { stateGame } from '../stateGame.svelte';
import { SLOW_MOTION_FACTOR, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import type {
	BookEventGameStart,
	BookEventKick,
	BookEventBounce,
	BookEventHeadCatapult,
} from '../typesBookEvent';

// Physics constants — tuned for visual feel on a 45° slope
const VEL_SCALE = 30;     // convert event velocity → world velocity
const GRAVITY = 400;       // world units/s² (pulls robot down)
const ROBOT_OFFSET_Y = -30; // robot center offset above slope surface

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

	// Physics state
	private physicsActive = false;
	private robotVx = 0;
	private robotVy = 0;       // positive = downward (screen coords)
	private robotAngularVel = 0;

	// Bounce waiting — resolves when robot hits slope
	private bounceResolve: (() => void) | null = null;

	// In-flight spin tracking
	private flightStartRotation = 0;
	private completedSpins = 0;
	private targetSpinCount = 0;       // exact spins from book event
	private flightElapsed = 0;         // time since launch
	private estimatedFlightTime = 1;   // estimated total flight duration

	// Landing alignment — robot visually matches landing type before impact
	private pendingLandingType: string | null = null;

	// Head catapult
	private headContainer: PIXI.Container | null = null;
	private headPhysicsActive = false;
	private headVx = 0;
	private headVy = 0;
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
			const speed = Math.sqrt(this.robotVx ** 2 + this.robotVy ** 2);
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

		// Apply gravity
		this.robotVy += GRAVITY * dt;

		// Move robot
		this.robot.x += this.robotVx * dt;
		this.robot.y += this.robotVy * dt;

		const slopeYHere = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;
		const heightAboveSlope = slopeYHere - this.robot.y;

		// --- Rotation ---
		if (this.targetSpinCount > 0) {
			// Eased spins through the full flight arc
			const progress = Math.min(1, this.flightElapsed / this.estimatedFlightTime);
			const easedProgress = easeInOutCubic(progress);
			const targetRotation = this.flightStartRotation + this.targetSpinCount * Math.PI * 2 * easedProgress;
			this.robot.setRotation(targetRotation);
		} else {
			// No spins — gentle tumble
			this.robot.setRotation(this.robot.rotation + this.robotAngularVel * dt);
		}
		this.robot.container.position.set(this.robot.x, this.robot.y);

		// Detect completed spins mid-flight → show notifications
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

		// Check collision with slope
		if (this.slope && this.robotVy > 0) {
			const slopeY = this.slope.getSlopeYAtX(this.robot.x) + ROBOT_OFFSET_Y;
			if (this.robot.y >= slopeY) {
				this.robot.y = slopeY;
				// Snap to landing pose on impact — masked by sparks + screen shake
				if (this.pendingLandingType) {
					this.robot.setRotation(this.getLandingAngle(this.pendingLandingType));
					this.pendingLandingType = null;
				}
				this.robot.container.position.set(this.robot.x, this.robot.y);
				this.physicsActive = false;

				if (this.bounceResolve) {
					this.bounceResolve();
					this.bounceResolve = null;
				}
			}
		}
	}

	/** Target rotation angle for each landing type */
	private getLandingAngle(landingType: string): number {
		switch (landingType) {
			case 'both_feet': return 0;                   // upright
			case 'one_leg':   return Math.PI * 0.15;      // slight tilt
			case 'arm':       return Math.PI * 0.5;       // sideways
			case 'body':      return Math.PI * 0.7;       // nearly face-down
			case 'head':      return Math.PI;              // upside down
			default:          return 0;
		}
	}

	private updateHeadPhysics(dt: number): void {
		if (!this.headPhysicsActive || !this.headContainer) return;

		this.headVy += GRAVITY * dt;
		const hx = this.headContainer.position.x + this.headVx * dt;
		const hy = this.headContainer.position.y + this.headVy * dt;
		this.headContainer.position.set(hx, hy);
		this.headContainer.rotation += this.headAngularVel * dt;

		// Check if head hit the slope
		if (this.slope && this.headVy > 0) {
			const slopeY = this.slope.getSlopeYAtX(hx);
			if (hy >= slopeY) {
				this.headPhysicsActive = false;
				this.headContainer.position.y = slopeY;
				if (this.headResolve) {
					this.headResolve();
					this.headResolve = null;
				}
			}
		}
	}

	private updateDetachedLimbs(dt: number): void {
		for (let i = this.detachedLimbs.length - 1; i >= 0; i--) {
			const limb = this.detachedLimbs[i];
			limb.vy += GRAVITY * dt;
			limb.container.position.x += limb.vx * dt;
			limb.container.position.y += limb.vy * dt;
			limb.container.rotation += limb.rotSpeed * dt;
			limb.container.alpha -= dt * 0.4;

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

	async setupRound(event: BookEventGameStart): Promise<void> {
		if (this.robot) this.robot.destroy();

		// Spin the wheel to selected robot
		if (this.robotWheel) {
			this.robotWheel.setVisible(true);
			await this.robotWheel.selectRobot(event.robot);
		}

		// Create robot at kicker position
		this.robot = new Robot(event.robot, this.worldContainer);
		const startSlopeY = this.slope ? this.slope.getSlopeYAtX(60) : 60;
		this.robot.setPosition(60, startSlopeY + ROBOT_OFFSET_Y);

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

		// Hide wheel, play kick animation
		if (this.robotWheel) this.robotWheel.setVisible(false);
		if (this.kicker) await this.kicker.kick();

		// Launch robot with initial velocity from event
		this.robotVx = event.initialVx * VEL_SCALE;
		this.robotVy = event.initialVy * VEL_SCALE;
		this.robotAngularVel = event.initialVx * 0.3; // gentle initial tumble
		this.targetSpinCount = 0; // no target spins for kick
		this.flightStartRotation = this.robot.rotation;
		this.completedSpins = 0;
		this.flightElapsed = 0;
		this.estimatedFlightTime = 1;
		this.physicsActive = true;
	}

	async waitForBounce(event: BookEventBounce): Promise<void> {
		if (!this.robot) return;

		// Tell physics what landing type to align to before impact
		this.pendingLandingType = event.landedOn;

		// If physics aren't active (first bounce after crash anim etc), start them
		if (!this.physicsActive) {
			// Robot is on slope, physics will be activated by launchFromBounce
			return;
		}

		// Wait for physics to detect slope collision
		return new Promise<void>((resolve) => {
			this.bounceResolve = resolve;
		});
	}

	async launchFromBounce(event: BookEventBounce): Promise<void> {
		if (!this.robot) return;

		const slopeY = this.slope ? this.slope.getSlopeYAtX(this.robot.x) : this.robot.y;

		// Spring compression on feet landing (non-blocking — fire and forget)
		if (event.landedOn === 'both_feet') {
			this.robot.compressLegs(); // no await!
		}

		// Sparks at impact
		if (this.effects) {
			this.effects.spawnSparks(this.robot.x, slopeY, event.landedOn === 'both_feet');
		}

		// Detach limb visually
		if (event.limbLost) {
			const detached = this.robot.detachLimb(event.limbLost, this.worldContainer);
			if (detached && this.effects) {
				this.effects.spawnBolts(this.robot.x, slopeY);
				this.detachedLimbs.push({
					container: detached,
					vx: this.robotVx * 0.3 + (Math.random() - 0.5) * 100,
					vy: -100 - Math.random() * 150,
					rotSpeed: (Math.random() - 0.5) * 15,
				});
			}
		}

		// Loosen limb visually
		if (event.limbLoosened) {
			this.robot.loosenLimb(event.limbLoosened);
		}

		// Floating text for penalties (spin notifications shown mid-flight)
		if (this.effects && event.penaltyDivisor > 1) {
			this.effects.spawnFloatingText(
				this.robot.x, slopeY - 60,
				`\u00F7${event.penaltyDivisor}`, 0xff4444, 20,
			);
		}

		// Launch with new velocity from event data
		this.robotVx = event.launchVx * VEL_SCALE;
		this.robotVy = event.launchVy * VEL_SCALE;

		// Reset spin tracking
		this.flightStartRotation = this.robot.rotation;
		this.completedSpins = 0;
		this.flightElapsed = 0;
		this.targetSpinCount = event.spinCount;

		// Use server-provided airTime for spin easing — it's the same value
		// that determined spinCount, so the visual rotation matches the flight.
		this.estimatedFlightTime = Math.max(0.5, event.airTime);

		if (event.spinCount > 0) {
			// Synced spins — angularVel not used, rotation is eased in updatePhysics
			this.robotAngularVel = 0;
		} else if (event.landedOn !== 'both_feet') {
			// Bad landing — moderate tumble
			this.robotAngularVel = ((Math.random() - 0.5) * 3) + (event.launchVx > 0 ? 1 : -1);
		} else {
			// Good landing, no spins — very gentle rotation
			this.robotAngularVel = (Math.random() - 0.5) * 0.8;
		}
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
					this.detachedLimbs.push({
						container: detached,
						vx: (Math.random() - 0.5) * 200,
						vy: -80 - Math.random() * 200,
						rotSpeed: (Math.random() - 0.5) * 20,
					});
				}
			}
		}

		// Brief pause so crash is visible
		await new Promise<void>(resolve => setTimeout(resolve, 600));
	}

	async playHeadCatapult(event: BookEventHeadCatapult): Promise<void> {
		if (!this.robot) return;

		// Use robot's actual visual position, not the math's positionX
		const robotX = this.robot.x;
		const robotY = this.robot.y;

		this.robot.detachBody();
		this.headContainer = this.robot.detachHead(this.worldContainer);

		this.headContainer.position.set(robotX, robotY - 10);
		this.headVx = event.headLaunchVx * VEL_SCALE;
		this.headVy = event.headLaunchVy * VEL_SCALE;
		this.headAngularVel = event.headSpinCount * Math.PI * 2 / event.headAirTime;
		this.headPhysicsActive = true;

		return new Promise<void>((resolve) => {
			this.headResolve = resolve;
		});
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
