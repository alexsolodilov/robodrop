// src/game/engine/Camera.ts
import * as PIXI from 'pixi.js';
import {
	CAMERA_LERP_RETENTION,
	CAMERA_LERP_RATE,
	CAMERA_ZOOM_NEAR,
	CAMERA_ZOOM_FAR,
	CAMERA_ZOOM_HEIGHT,
	CAMERA_LOOK_ABOVE,
} from '../constants';

/**
 * KR-style camera: 25% lerp per tick, dynamic zoom based on height above slope.
 * Frame-rate independent smoothing.
 */
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

	followTarget(targetX: number, targetY: number, slopeY?: number): void {
		this.targetX = targetX;

		// Look slightly above the robot based on height above slope
		const heightAboveSlope = slopeY !== undefined ? slopeY - targetY : 0;
		this.targetY = targetY - Math.max(0, heightAboveSlope) * CAMERA_LOOK_ABOVE;

		// Dynamic zoom based on height above slope
		if (slopeY !== undefined) {
			const t = Math.max(0, Math.min(1, heightAboveSlope / CAMERA_ZOOM_HEIGHT));
			this.targetZoom = CAMERA_ZOOM_NEAR + (CAMERA_ZOOM_FAR - CAMERA_ZOOM_NEAR) * t;
		}
	}

	shake(intensity: number, durationMs: number): void {
		this.shakeIntensity = intensity;
		this.shakeTimer = durationMs;
	}

	update(dt: number): void {
		// Frame-rate independent lerp: factor = 1 - retention^(dt * referenceRate)
		const lerpFactor = 1 - Math.pow(CAMERA_LERP_RETENTION, dt * CAMERA_LERP_RATE);

		this.x += (this.targetX - this.x) * lerpFactor;
		this.y += (this.targetY - this.y) * lerpFactor;
		this.zoom += (this.targetZoom - this.zoom) * lerpFactor;

		// Don't go above start
		this.x = Math.max(-100, this.x);

		// Shake
		if (this.shakeTimer > 0) {
			this.shakeTimer -= dt * 1000;
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
