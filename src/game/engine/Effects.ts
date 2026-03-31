import * as PIXI from 'pixi.js';
import { SPARK_COUNT, BOLT_PARTICLE_COUNT, COLORS } from '../constants';

interface Particle {
	sprite: PIXI.Graphics;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	gravity: number;
	rotationSpeed: number;
}

export class Effects {
	public container: PIXI.Container;
	private particles: Particle[] = [];

	constructor(parentContainer: PIXI.Container) {
		this.container = new PIXI.Container();
		parentContainer.addChild(this.container);
	}

	spawnSparks(x: number, y: number, good: boolean): void {
		const color = good ? COLORS.sparkGood : COLORS.sparkBad;
		const count = SPARK_COUNT;

		for (let i = 0; i < count; i++) {
			const spark = new PIXI.Graphics();
			spark.circle(0, 0, 2 + Math.random() * 2);
			spark.fill(color);
			spark.position.set(x, y);

			const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
			const speed = 2 + Math.random() * 4;

			this.container.addChild(spark);
			this.particles.push({
				sprite: spark,
				vx: Math.cos(angle) * speed * (good ? 1 : 0.7),
				vy: Math.sin(angle) * speed - 2,
				life: 1,
				maxLife: 1,
				gravity: 0.15,
				rotationSpeed: 0,
			});
		}
	}

	spawnBolts(x: number, y: number): void {
		for (let i = 0; i < BOLT_PARTICLE_COUNT; i++) {
			const bolt = new PIXI.Graphics();

			// Random bolt/nut shape
			if (Math.random() > 0.5) {
				bolt.rect(-2, -2, 4, 4);
			} else {
				bolt.circle(0, 0, 2);
			}
			bolt.fill(COLORS.boltParticle);
			bolt.position.set(x, y);

			const angle = Math.random() * Math.PI * 2;
			const speed = 1 + Math.random() * 3;

			this.container.addChild(bolt);
			this.particles.push({
				sprite: bolt,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 3,
				life: 1.5,
				maxLife: 1.5,
				gravity: 0.2,
				rotationSpeed: (Math.random() - 0.5) * 10,
			});
		}
	}

	spawnFloatingText(
		x: number,
		y: number,
		text: string,
		color: number,
		size: number = 16,
	): void {
		const textStyle = new PIXI.TextStyle({
			fontFamily: 'Arial',
			fontSize: size,
			fontWeight: 'bold',
			fill: color,
			stroke: { color: 0x000000, width: 3 },
		});

		const textSprite = new PIXI.Text({ text, style: textStyle });
		textSprite.anchor.set(0.5);
		textSprite.position.set(x, y);

		const textContainer = new PIXI.Container();
		textContainer.addChild(textSprite);
		this.container.addChild(textContainer);

		// Treat as particle for animation
		const fakeGraphics = textSprite as unknown as PIXI.Graphics;
		this.particles.push({
			sprite: fakeGraphics,
			vx: 0,
			vy: -1.5,
			life: 2,
			maxLife: 2,
			gravity: 0,
			rotationSpeed: 0,
		});
	}

	spawnTrail(x: number, y: number, speed: number): void {
		const trail = new PIXI.Graphics();
		const size = Math.min(3, speed * 0.3);
		trail.circle(0, 0, size);
		trail.fill({ color: 0xffffff, alpha: 0.4 });
		trail.position.set(x, y);

		this.container.addChild(trail);
		this.particles.push({
			sprite: trail,
			vx: -0.5,
			vy: 0,
			life: 0.5,
			maxLife: 0.5,
			gravity: 0,
			rotationSpeed: 0,
		});
	}

	update(deltaTime: number): void {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];

			p.vy += p.gravity * deltaTime;
			p.sprite.position.x += p.vx;
			p.sprite.position.y += p.vy;
			p.sprite.rotation += p.rotationSpeed * deltaTime;

			p.life -= deltaTime;
			p.sprite.alpha = Math.max(0, p.life / p.maxLife);

			if (p.life <= 0) {
				this.container.removeChild(p.sprite);
				p.sprite.destroy();
				this.particles.splice(i, 1);
			}
		}
	}

	clear(): void {
		for (const p of this.particles) {
			this.container.removeChild(p.sprite);
			p.sprite.destroy();
		}
		this.particles = [];
	}

	destroy(): void {
		this.clear();
		this.container.destroy({ children: true });
	}
}
