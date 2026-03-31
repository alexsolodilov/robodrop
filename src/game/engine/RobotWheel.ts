import * as PIXI from 'pixi.js';
import type { RobotType } from '../types';

/**
 * Robot selection wheel — a rotating wheel with robot silhouettes.
 * Spins to position the selected robot in front of the kicker.
 */
export class RobotWheel {
	public container: PIXI.Container;
	private wheel: PIXI.Container;
	private axle: PIXI.Graphics;
	private robotIcons: Map<RobotType, PIXI.Container> = new Map();

	private currentAngle = 0;
	private targetAngle = 0;
	private spinning = false;

	// Robots are placed at these angles on the wheel
	private robotAngles: Record<RobotType, number> = {
		tank: 0,            // right side (in front of kicker)
		acro: Math.PI,      // left side
	};

	constructor(parentContainer: PIXI.Container, x: number, y: number) {
		this.container = new PIXI.Container();
		this.container.position.set(x, y);

		// Wheel rim
		const rim = new PIXI.Graphics();
		rim.circle(0, 0, 50);
		rim.stroke({ width: 4, color: 0x555577 });
		rim.circle(0, 0, 3);
		rim.fill(0x888899);
		this.container.addChild(rim);

		// Rotating part
		this.wheel = new PIXI.Container();

		// Groove/track on wheel
		const groove = new PIXI.Graphics();
		groove.circle(0, 0, 45);
		groove.stroke({ width: 2, color: 0x444466, alpha: 0.5 });
		this.wheel.addChild(groove);

		// Spokes
		const spokes = new PIXI.Graphics();
		for (let i = 0; i < 4; i++) {
			const angle = (i / 4) * Math.PI * 2;
			spokes.moveTo(0, 0);
			spokes.lineTo(Math.cos(angle) * 45, Math.sin(angle) * 45);
		}
		spokes.stroke({ width: 2, color: 0x444466, alpha: 0.3 });
		this.wheel.addChild(spokes);

		// Robot icons on the wheel
		this.createRobotIcon('tank', 0x4a6fa5, 'T');
		this.createRobotIcon('acro', 0xe85d75, 'A');

		this.container.addChild(this.wheel);

		// Axle bolt on top
		this.axle = new PIXI.Graphics();
		this.axle.circle(0, 0, 6);
		this.axle.fill(0x777799);
		this.axle.circle(0, 0, 2);
		this.axle.fill(0x333355);
		this.container.addChild(this.axle);

		// Mount bracket
		const bracket = new PIXI.Graphics();
		bracket.rect(-8, -60, 16, 20);
		bracket.fill(0x555577);
		this.container.addChild(bracket);

		parentContainer.addChild(this.container);
	}

	private createRobotIcon(type: RobotType, color: number, letter: string): void {
		const icon = new PIXI.Container();
		const angle = this.robotAngles[type];

		// Small robot silhouette
		const body = new PIXI.Graphics();
		body.roundRect(-8, -10, 16, 20, 3);
		body.fill(color);

		// Label
		const label = new PIXI.Text({
			text: letter,
			style: { fontSize: 10, fontWeight: 'bold', fill: 0xffffff },
		});
		label.anchor.set(0.5);
		label.position.set(0, 0);

		icon.addChild(body);
		icon.addChild(label);

		// Position on wheel edge
		icon.position.set(Math.cos(angle) * 40, Math.sin(angle) * 40);
		icon.rotation = angle; // face outward

		this.wheel.addChild(icon);
		this.robotIcons.set(type, icon);
	}

	/** Spin wheel to position the selected robot at the "launch" position (right side). */
	async selectRobot(type: RobotType): Promise<void> {
		const robotAngle = this.robotAngles[type];
		// We want this robot at angle 0 (right side)
		// So we need to rotate the wheel by -robotAngle
		this.targetAngle = -robotAngle;

		// Add extra full rotations for visual spin
		const extraSpins = Math.PI * 2 * 2; // 2 full rotations
		const diff = this.targetAngle - this.currentAngle - extraSpins;

		this.spinning = true;

		return new Promise((resolve) => {
			const startAngle = this.currentAngle;
			const totalRotation = this.targetAngle - startAngle - extraSpins;
			const startTime = performance.now();
			const duration = 800; // ms

			const animate = () => {
				const elapsed = performance.now() - startTime;
				const t = Math.min(1, elapsed / duration);
				const eased = easeOutCubic(t);

				this.currentAngle = startAngle + totalRotation * eased;
				this.wheel.rotation = this.currentAngle;

				// Counter-rotate icons so they stay upright
				for (const [, icon] of this.robotIcons) {
					icon.rotation = -this.currentAngle;
				}

				if (t < 1) {
					requestAnimationFrame(animate);
				} else {
					this.currentAngle = this.targetAngle;
					this.wheel.rotation = this.currentAngle;
					this.spinning = false;
					resolve();
				}
			};
			requestAnimationFrame(animate);
		});
	}

	setVisible(visible: boolean): void {
		this.container.visible = visible;
	}

	destroy(): void {
		this.container.destroy({ children: true });
	}
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}
