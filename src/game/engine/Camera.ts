import * as PIXI from 'pixi.js';

/**
 * Camera with dynamic zoom:
 * - Follows robot, centered on screen
 * - Zooms IN when robot is near slope surface
 * - Zooms OUT when robot is high in the air
 * - Smooth transitions
 */

const FOLLOW_SMOOTH = 0.08;
const ZOOM_SMOOTH = 0.04;
const ZOOM_NEAR = 1.8;   // zoomed in when touching ground
const ZOOM_FAR = 0.7;    // zoomed out when high in air
const ZOOM_HEIGHT_THRESHOLD = 250; // pixels above slope for full zoom-out

export class Camera {
	public x = 0;
	public y = 0;
	public zoom = 1.2;

	private targetX = 0;
	private targetY = 0;
	private targetZoom = 1.2;

	private shakeIntensity = 0;
	private shakeTimer = 0;

	private screenWidth: number;
	private screenHeight: number;

	constructor(width: number, height: number) {
		this.screenWidth = width;
		this.screenHeight = height;
	}

	/**
	 * @param targetX - robot world X
	 * @param targetY - robot world Y
	 * @param slopeY - slope surface Y at robot's X position
	 */
	followTarget(targetX: number, targetY: number, slopeY?: number): void {
		// Camera tracks robot's world position directly;
		// screen offset is applied in applyToContainer so zoom changes
		// don't cause uneven horizontal/vertical drift.
		this.targetX = targetX;
		this.targetY = targetY;

		// Dynamic zoom based on height above slope
		if (slopeY !== undefined) {
			const heightAboveSlope = slopeY - targetY; // positive when above slope
			const t = Math.max(0, Math.min(1, heightAboveSlope / ZOOM_HEIGHT_THRESHOLD));
			this.targetZoom = ZOOM_NEAR + (ZOOM_FAR - ZOOM_NEAR) * t;
		}
	}

	shake(intensity: number, durationMs: number): void {
		this.shakeIntensity = intensity;
		this.shakeTimer = durationMs;
	}

	update(deltaTime: number): void {
		// Smooth follow
		this.x += (this.targetX - this.x) * FOLLOW_SMOOTH;
		this.y += (this.targetY - this.y) * FOLLOW_SMOOTH;
		this.zoom += (this.targetZoom - this.zoom) * ZOOM_SMOOTH;

		// Don't go above start
		this.x = Math.max(-100, this.x);

		// Shake
		if (this.shakeTimer > 0) {
			this.shakeTimer -= deltaTime * 1000;
			if (this.shakeTimer <= 0) this.shakeIntensity = 0;
		}
	}

	applyToContainer(container: PIXI.Container): void {
		let offsetX = 0;
		let offsetY = 0;

		if (this.shakeIntensity > 0) {
			offsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
			offsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
		}

		container.scale.set(this.zoom);
		container.position.set(
			-this.x * this.zoom + this.screenWidth * 0.35 + offsetX,
			-this.y * this.zoom + this.screenHeight * 0.5 + offsetY,
		);
	}

	resize(width: number, height: number): void {
		this.screenWidth = width;
		this.screenHeight = height;
	}
}
