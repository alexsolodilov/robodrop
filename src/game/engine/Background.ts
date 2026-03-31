import * as PIXI from 'pixi.js';

/**
 * Background: dark sky with gradient (like Kamikaze Robots).
 * Deep blue/purple at top → lighter blue at horizon.
 * Stars/particles scattered. Mountains as dark silhouettes.
 */
export class Background {
	public container: PIXI.Container;
	private mountains: PIXI.Graphics;
	private stars: PIXI.Container;

	constructor(parentContainer: PIXI.Container) {
		this.container = new PIXI.Container();

		// Sky gradient — drawn large enough to cover any camera position
		const sky = new PIXI.Graphics();
		const bands = [
			{ color: 0x0a0a2e, y: -2000 },
			{ color: 0x0d1040, y: -1200 },
			{ color: 0x121855, y: -600 },
			{ color: 0x1a2570, y: -200 },
			{ color: 0x1e3a8a, y: 200 },
			{ color: 0x2563a0, y: 600 },
			{ color: 0x3b82b0, y: 1000 },
		];
		for (let i = 0; i < bands.length - 1; i++) {
			sky.rect(-1000, bands[i].y, 5000, bands[i + 1].y - bands[i].y);
			sky.fill(bands[i].color);
		}
		// Fill below last band
		sky.rect(-1000, bands[bands.length - 1].y, 5000, 3000);
		sky.fill(bands[bands.length - 1].color);
		this.container.addChild(sky);

		// Stars
		this.stars = new PIXI.Container();
		for (let i = 0; i < 80; i++) {
			const star = new PIXI.Graphics();
			const size = 0.5 + Math.random() * 2;
			star.circle(0, 0, size);
			star.fill({ color: 0xffffff, alpha: 0.3 + Math.random() * 0.5 });
			star.position.set(
				-500 + Math.random() * 4000,
				-1500 + Math.random() * 2000,
			);
			this.stars.addChild(star);
		}
		this.container.addChild(this.stars);

		// Distant mountain silhouettes (parallax)
		this.mountains = new PIXI.Graphics();
		this.mountains.moveTo(-500, 300);
		const peaks = [
			[-300, 50], [-100, 180], [100, -20], [400, 120],
			[700, -50], [1000, 100], [1300, -30], [1600, 150],
			[1900, 0], [2200, 130], [2500, -40], [2800, 160],
			[3100, 20], [3400, 140], [3700, 300],
		];
		for (const [x, yOffset] of peaks) {
			this.mountains.lineTo(x, 150 + yOffset);
		}
		this.mountains.lineTo(4000, 800);
		this.mountains.lineTo(-500, 800);
		this.mountains.closePath();
		this.mountains.fill({ color: 0x0d0d25, alpha: 0.6 });
		this.container.addChild(this.mountains);

		parentContainer.addChild(this.container);
	}

	update(cameraX: number): void {
		// Parallax: stars move slow, mountains medium
		this.stars.position.x = -cameraX * 0.03;
		this.mountains.position.x = -cameraX * 0.08;
	}

	destroy(): void {
		this.container.destroy({ children: true });
	}
}
