import * as PIXI from 'pixi.js';
import { FINISH_LINE_X } from '../constants';

/**
 * Dynamic slope built from Catmull-Rom spline through bounce landing points.
 * Terrain is constructed incrementally as bounce events arrive.
 */

interface ControlPoint {
	x: number;
	y: number;
}

export class Slope {
	public container: PIXI.Container;
	private controlPoints: ControlPoint[] = [];
	private slopeGraphics: PIXI.Graphics;
	private edgeGraphics: PIXI.Graphics;
	private rocksGraphics: PIXI.Graphics;
	private finishGraphics: PIXI.Graphics | null = null;

	private finishX = FINISH_LINE_X;

	constructor(parentContainer: PIXI.Container) {
		this.container = new PIXI.Container();
		this.slopeGraphics = new PIXI.Graphics();
		this.edgeGraphics = new PIXI.Graphics();
		this.rocksGraphics = new PIXI.Graphics();

		this.container.addChild(this.slopeGraphics);
		this.container.addChild(this.edgeGraphics);
		this.container.addChild(this.rocksGraphics);

		parentContainer.addChild(this.container);
	}

	/**
	 * Initialize terrain with the starting point.
	 * Call once at round start before any bounces.
	 */
	initTerrain(
		startX: number,
		startY: number,
		finishX: number,
		landingPoints: { x: number; y: number }[] = [],
	): void {
		this.controlPoints = [];
		this.finishX = finishX;

		// Start area
		this.controlPoints.push({ x: startX - 100, y: startY - 20 });
		this.controlPoints.push({ x: startX, y: startY });

		if (landingPoints.length > 0) {
			// Build terrain through actual landing points from book events
			for (const pt of landingPoints) {
				this.controlPoints.push({ x: pt.x, y: pt.y });
			}
			// Extend past the last landing point to finish + buffer
			const last = landingPoints[landingPoints.length - 1];
			const prev = landingPoints.length > 1
				? landingPoints[landingPoints.length - 2]
				: { x: startX, y: startY };
			const slope = (last.y - prev.y) / Math.max(1, last.x - prev.x);
			const endX = finishX + 500;
			this.controlPoints.push({ x: endX, y: last.y + slope * (endX - last.x) });
		} else {
			// Fallback: generate a synthetic downhill slope
			const slopeGradient = 0.8;
			const totalLen = finishX + 500;
			const numPoints = 12;
			for (let i = 1; i <= numPoints; i++) {
				const x = startX + (totalLen - startX) * i / numPoints;
				const baseY = startY + (x - startX) * slopeGradient;
				const variation = Math.sin(i * 1.7) * 30 + Math.cos(i * 0.9) * 15;
				this.controlPoints.push({ x, y: baseY + variation });
			}
		}

		this.redraw();
		this.drawFinishLine();
	}

	/**
	 * Add a landing point from a bounce event.
	 * The spline will pass through this point exactly.
	 */
	addLandingPoint(_x: number, _y: number): void {
		// No-op: terrain is pre-generated at init and stays fixed.
		// Robot landing positions come from analytical trajectories,
		// not terrain collision, so the slope doesn't need to match exactly.
	}

	/**
	 * Finalize the terrain — add endpoint beyond finish line.
	 */
	finalize(): void {
		this.redraw();
		this.drawFinishLine();
	}

	/**
	 * Get slope Y at any world X position.
	 * Uses Catmull-Rom interpolation through control points.
	 */
	getSlopeYAtX(x: number): number {
		const pts = this.controlPoints;
		if (pts.length === 0) return 0;
		if (pts.length === 1) return pts[0].y;

		// Clamp to range
		if (x <= pts[0].x) return pts[0].y;
		if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

		// Find segment
		let i = 0;
		for (i = 0; i < pts.length - 1; i++) {
			if (x >= pts[i].x && x < pts[i + 1].x) break;
		}

		// Catmull-Rom needs 4 points: p0, p1, p2, p3
		const p0 = pts[Math.max(0, i - 1)];
		const p1 = pts[i];
		const p2 = pts[Math.min(pts.length - 1, i + 1)];
		const p3 = pts[Math.min(pts.length - 1, i + 2)];

		const t = (x - p1.x) / Math.max(1, p2.x - p1.x);

		const baseY = catmullRom(p0.y, p1.y, p2.y, p3.y, t);

		// Small surface texture noise
		const bump = Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2;

		return baseY + bump;
	}

	private redraw(): void {
		const pts = this.controlPoints;
		if (pts.length < 2) return;

		this.slopeGraphics.clear();
		this.edgeGraphics.clear();
		this.rocksGraphics.clear();

		const startX = pts[0].x - 200;
		const endX = pts[pts.length - 1].x + 200;
		const step = 8; // pixels per segment for smooth curve

		// Build surface path
		const surfacePoints: { x: number; y: number }[] = [];
		for (let x = startX; x <= endX; x += step) {
			surfacePoints.push({ x, y: this.getSlopeYAtX(x) });
		}

		// Fill polygon (surface → bottom)
		this.slopeGraphics.moveTo(surfacePoints[0].x, surfacePoints[0].y);
		for (const p of surfacePoints) {
			this.slopeGraphics.lineTo(p.x, p.y);
		}
		const maxY = Math.max(...surfacePoints.map(p => p.y)) + 800;
		this.slopeGraphics.lineTo(endX, maxY);
		this.slopeGraphics.lineTo(startX, maxY);
		this.slopeGraphics.closePath();
		this.slopeGraphics.fill(0x1a1a2e);

		// Edge highlight
		this.edgeGraphics.moveTo(surfacePoints[0].x, surfacePoints[0].y);
		for (const p of surfacePoints) {
			this.edgeGraphics.lineTo(p.x, p.y);
		}
		this.edgeGraphics.stroke({ width: 3, color: 0x2d2d4e });

		// Scattered rocks
		for (let x = pts[0].x; x < endX - 200; x += 60 + Math.random() * 80) {
			const y = this.getSlopeYAtX(x);
			const size = 3 + Math.random() * 6;
			this.rocksGraphics.circle(x, y - size * 0.3, size);
			this.rocksGraphics.fill({ color: 0x252545, alpha: 0.8 });
		}
	}

	private drawFinishLine(): void {
		if (this.finishGraphics) {
			this.container.removeChild(this.finishGraphics);
			this.finishGraphics.destroy();
		}

		const g = new PIXI.Graphics();
		const finishY = this.getSlopeYAtX(this.finishX);

		// Tall finish pole
		g.rect(this.finishX - 2, finishY - 120, 4, 120);
		g.fill(0xffeb3b);

		// Checkered flag
		const flagW = 36;
		const flagH = 24;
		const cellSize = 6;
		for (let row = 0; row < flagH / cellSize; row++) {
			for (let col = 0; col < flagW / cellSize; col++) {
				const color = (row + col) % 2 === 0 ? 0xffffff : 0x000000;
				g.rect(
					this.finishX + 2 + col * cellSize,
					finishY - 120 + row * cellSize,
					cellSize, cellSize,
				);
				g.fill(color);
			}
		}

		// Glow line on ground
		g.rect(this.finishX - 20, finishY - 2, 40, 4);
		g.fill({ color: 0xffd700, alpha: 0.6 });

		this.finishGraphics = g;
		this.container.addChild(g);
	}

	destroy(): void {
		this.container.destroy({ children: true });
	}
}

/** Catmull-Rom spline interpolation */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return 0.5 * (
		(2 * p1) +
		(-p0 + p2) * t +
		(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
		(-p0 + 3 * p1 - 3 * p2 + p3) * t3
	);
}
