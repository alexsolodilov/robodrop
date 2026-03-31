import * as PIXI from 'pixi.js';
import { SLOPE_LENGTH, FINISH_LINE_X } from '../constants';

// Steep slope ~45 degrees, dark silhouette style (like Kamikaze Robots)
// World coords: X goes right (0 to SLOPE_LENGTH), Y goes down
// Slope drops steeply: for every 1 unit right, drops ~1 unit down
const SLOPE_ANGLE = Math.PI / 4; // 45 degrees
const SLOPE_DROP_RATIO = Math.tan(SLOPE_ANGLE); // 1.0

export class Slope {
	public container: PIXI.Container;

	constructor(parentContainer: PIXI.Container) {
		this.container = new PIXI.Container();
		this.drawSlope();
		this.drawFinishLine();
		parentContainer.addChild(this.container);
	}

	private drawSlope(): void {
		const g = new PIXI.Graphics();

		// Dark silhouette slope — long polygon from start to well past finish
		const totalLen = SLOPE_LENGTH + 500;
		const startY = 0;
		const endY = totalLen * SLOPE_DROP_RATIO;

		// Top edge of slope (the surface the robot bounces on)
		g.moveTo(-200, startY);
		// Add some rocky irregularity
		const segments = 60;
		for (let i = 0; i <= segments; i++) {
			const x = (i / segments) * totalLen;
			const baseY = x * SLOPE_DROP_RATIO;
			// Small random bumps for texture
			const bump = Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13) * 4;
			g.lineTo(x, baseY + bump);
		}
		// Close polygon down and back
		g.lineTo(totalLen, endY + 800);
		g.lineTo(-200, 800);
		g.closePath();
		g.fill(0x1a1a2e); // dark silhouette

		// Surface edge highlight
		const edge = new PIXI.Graphics();
		edge.moveTo(-200, 0);
		for (let i = 0; i <= segments; i++) {
			const x = (i / segments) * totalLen;
			const baseY = x * SLOPE_DROP_RATIO;
			const bump = Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13) * 4;
			edge.lineTo(x, baseY + bump);
		}
		edge.stroke({ width: 3, color: 0x2d2d4e });

		// Scattered rocks on surface
		const rocks = new PIXI.Graphics();
		for (let x = 50; x < totalLen; x += 60 + Math.random() * 80) {
			const baseY = x * SLOPE_DROP_RATIO;
			const size = 3 + Math.random() * 6;
			rocks.circle(x, baseY - size * 0.3, size);
			rocks.fill({ color: 0x252545, alpha: 0.8 });
		}

		this.container.addChild(g);
		this.container.addChild(edge);
		this.container.addChild(rocks);
	}

	private drawFinishLine(): void {
		const g = new PIXI.Graphics();
		const finishY = this.getSlopeYAtX(FINISH_LINE_X);

		// Tall finish pole
		g.rect(FINISH_LINE_X - 2, finishY - 120, 4, 120);
		g.fill(0xffeb3b);

		// Checkered flag
		const flagW = 36;
		const flagH = 24;
		const cellSize = 6;
		for (let row = 0; row < flagH / cellSize; row++) {
			for (let col = 0; col < flagW / cellSize; col++) {
				const color = (row + col) % 2 === 0 ? 0xffffff : 0x000000;
				g.rect(FINISH_LINE_X + 2 + col * cellSize, finishY - 120 + row * cellSize, cellSize, cellSize);
				g.fill(color);
			}
		}

		// Glow line on ground
		g.rect(FINISH_LINE_X - 20, finishY - 2, 40, 4);
		g.fill({ color: 0xffd700, alpha: 0.6 });

		this.container.addChild(g);
	}

	getSlopeYAtX(x: number): number {
		// Clamp to slope length — beyond that, return the end-of-slope value
		const clampedX = Math.min(x, SLOPE_LENGTH + 200);
		const baseY = clampedX * SLOPE_DROP_RATIO;
		const bump = Math.sin(clampedX * 0.05) * 8 + Math.sin(clampedX * 0.13) * 4;
		return baseY + bump;
	}

	destroy(): void {
		this.container.destroy({ children: true });
	}
}
