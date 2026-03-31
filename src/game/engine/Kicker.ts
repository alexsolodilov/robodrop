import * as PIXI from 'pixi.js';

/**
 * Kicking mechanism at the top of the slope.
 * A spring-loaded foot/piston that launches the robot.
 */
export class Kicker {
	public container: PIXI.Container;
	private arm: PIXI.Graphics;
	private base: PIXI.Graphics;
	private spring: PIXI.Graphics;
	private foot: PIXI.Graphics;

	private armRotation = -0.3; // resting angle (pulled back slightly)
	private animating = false;

	constructor(parentContainer: PIXI.Container, x: number, y: number) {
		this.container = new PIXI.Container();
		this.container.position.set(x, y);

		// Base/mount
		this.base = new PIXI.Graphics();
		this.base.roundRect(-20, -30, 40, 60, 4);
		this.base.fill(0x555577);
		this.base.rect(-25, -5, 50, 10);
		this.base.fill(0x444466);
		this.container.addChild(this.base);

		// Spring coil (visual)
		this.spring = new PIXI.Graphics();
		this.drawSpring(0);
		this.container.addChild(this.spring);

		// Kicking arm
		this.arm = new PIXI.Graphics();
		this.arm.rect(0, -6, 60, 12);
		this.arm.fill(0x666688);
		this.arm.roundRect(55, -10, 20, 20, 4);
		this.arm.fill(0xff6644); // foot/boot
		this.arm.pivot.set(0, 0);
		this.arm.rotation = this.armRotation;
		this.container.addChild(this.arm);

		// Foot
		this.foot = new PIXI.Graphics();

		parentContainer.addChild(this.container);
	}

	private drawSpring(extension: number): void {
		this.spring.clear();
		const segments = 4;
		const baseX = 5;
		const len = 30 + extension * 20;
		const segH = len / segments;

		this.spring.moveTo(baseX, 0);
		for (let i = 0; i < segments; i++) {
			const x1 = baseX + (i + 0.5) * segH;
			const dir = i % 2 === 0 ? -8 : 8;
			this.spring.lineTo(x1, dir);
		}
		this.spring.lineTo(baseX + len, 0);
		this.spring.stroke({ width: 3, color: 0x888899, cap: 'round', join: 'round' });
	}

	/** Animate the kick — arm swings forward, then resets. */
	async kick(): Promise<void> {
		if (this.animating) return;
		this.animating = true;

		return new Promise((resolve) => {
			const startTime = performance.now();
			const startAngle = this.armRotation;
			const kickAngle = 0.8; // swing forward
			const totalDuration = 400; // ms

			const animate = () => {
				const elapsed = performance.now() - startTime;
				const t = Math.min(1, elapsed / totalDuration);

				if (t < 0.3) {
					// Wind up (pull back more)
					const windUp = t / 0.3;
					this.arm.rotation = startAngle - 0.3 * windUp;
					this.drawSpring(-windUp * 0.5);
				} else if (t < 0.5) {
					// KICK! Fast swing forward
					const kick = (t - 0.3) / 0.2;
					this.arm.rotation = startAngle - 0.3 + (kickAngle + 0.3) * easeOutQuad(kick);
					this.drawSpring(kick);
				} else {
					// Return to rest
					const rest = (t - 0.5) / 0.5;
					this.arm.rotation = kickAngle + (startAngle - kickAngle) * easeInOutQuad(rest);
					this.drawSpring((1 - rest) * 0.3);
				}

				if (t < 1) {
					requestAnimationFrame(animate);
				} else {
					this.arm.rotation = this.armRotation;
					this.drawSpring(0);
					this.animating = false;
					resolve();
				}
			};
			requestAnimationFrame(animate);
		});
	}

	destroy(): void {
		this.container.destroy({ children: true });
	}
}

function easeOutQuad(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

function easeInOutQuad(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
