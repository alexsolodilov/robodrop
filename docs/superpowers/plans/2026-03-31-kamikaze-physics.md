# Kamikaze Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace forward physics simulation with analytical inverse-kinematics trajectories, add spring-joint limbs, dynamic spline terrain, and KR-style camera.

**Architecture:** Book events provide start/end points and timing. Frontend computes exact parabolic arcs analytically (guaranteed landing precision). Limbs swing on spring joints during flight. Terrain is a Catmull-Rom spline through landing points. Camera uses 25% lerp with dynamic zoom.

**Tech Stack:** TypeScript, PixiJS 8.x, Svelte 5

**Spec:** `docs/superpowers/specs/2026-03-31-kamikaze-physics-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/game/engine/SpringJoint.ts` | **Create** | Spring physics model for limb joints |
| `src/game/engine/Slope.ts` | **Rewrite** | Catmull-Rom spline terrain through landing points |
| `src/game/engine/Camera.ts` | **Modify** | 25% lerp, wider zoom range, frame-rate independent |
| `src/game/engine/Robot.ts` | **Modify** | Integrate SpringJoint into limb rendering |
| `src/game/engine/GameEngine.ts` | **Rewrite physics** | Analytical trajectory, spring joint updates, KR detach physics |
| `src/game/constants.ts` | **Modify** | Add KR-derived physics constants |
| `src/game/bookEventHandlerMap.ts` | **Modify** | Pass bounce points to Slope for terrain building |

---

### Task 1: Add KR Physics Constants

**Files:**
- Modify: `src/game/constants.ts`

- [ ] **Step 1: Add new constants to constants.ts**

Add the KR-derived constants after the existing ones. Remove the old `GRAVITY` and `GROUND_FRICTION` which are unused (GameEngine.ts has its own `GRAVITY = 400`).

```typescript
// In src/game/constants.ts — replace the Physics section and add new sections:

// Physics — Kamikaze Robots derived
export const KR_GRAVITY = 800;              // px/s² (aesthetic — steeper arcs)
export const KR_AIR_DRAG = 0.003;           // 0.3% velocity loss per 30ms tick
export const KR_TICK_RATE = 33;             // KR physics rate (fps) for unit conversion

// Spring joints
export const SPRING_STIFFNESS_LIMB = 60;
export const SPRING_STIFFNESS_EXTREMITY = 40;
export const SPRING_LIMIT_LIMB = 0.93;      // radians (~53 deg)
export const SPRING_LIMIT_EXTREMITY = 1.29;  // radians (~74 deg)
export const SPRING_DAMPING_LIMB = 0.95;
export const SPRING_DAMPING_EXTREMITY = 0.93;

// Limb detach — KR derived
export const LIMB_KICK_SPEED = 120;          // px/s lateral kick on detach
export const LIMB_KICK_UP = 150;             // px/s upward kick
export const LIMB_ANGULAR_VEL_MIN = 3;       // rad/s
export const LIMB_ANGULAR_VEL_MAX = 5;       // rad/s
export const LIMB_FADE_RATE = 0.4;           // alpha/s

// Camera — KR derived
export const CAMERA_LERP_RETENTION = 0.75;   // per-tick retention (25% lerp at 33fps)
export const CAMERA_LERP_RATE = 33;          // reference tick rate
export const CAMERA_ZOOM_NEAR = 1.8;
export const CAMERA_ZOOM_FAR = 0.5;
export const CAMERA_ZOOM_HEIGHT = 400;       // px above slope for full zoom-out
export const CAMERA_LOOK_ABOVE = 0.25;       // look-above factor

// Landing angles (radians)
export const LANDING_ANGLES: Record<string, number> = {
	both_feet: 0,
	one_leg: 0.15 * Math.PI,
	arm: 0.5 * Math.PI,
	body: 0.7 * Math.PI,
	head: Math.PI,
};
```

- [ ] **Step 2: Remove old unused physics constants**

Remove `GRAVITY = 0.35` and `GROUND_FRICTION = 0.98` from constants.ts (they are not imported anywhere — GameEngine.ts defines its own local `GRAVITY = 400`).

- [ ] **Step 3: Verify no imports break**

Run: `npx tsc --noEmit`
Expected: No errors related to removed constants.

- [ ] **Step 4: Commit**

```bash
git add src/game/constants.ts
git commit -m "feat: add Kamikaze Robots physics constants"
```

---

### Task 2: Create SpringJoint

**Files:**
- Create: `src/game/engine/SpringJoint.ts`

- [ ] **Step 1: Create SpringJoint class**

```typescript
// src/game/engine/SpringJoint.ts

export interface SpringJointConfig {
	stiffness: number;   // higher = slower spring (divisor for force)
	damping: number;     // 0..1, velocity retention per tick
	limit: number;       // max deflection in radians
}

export class SpringJoint {
	public angle = 0;             // current offset from rest position (radians)
	public angularVelocity = 0;   // rad/s

	private stiffness: number;
	private damping: number;
	private limit: number;

	constructor(config: SpringJointConfig) {
		this.stiffness = config.stiffness;
		this.damping = config.damping;
		this.limit = config.limit;
	}

	/**
	 * Update spring physics. Call once per frame.
	 * @param dt - delta time in seconds
	 * @param bodyAngularVelocity - parent body's angular velocity (rad/s).
	 *   Limb inertia resists body rotation, creating swing.
	 */
	update(dt: number, bodyAngularVelocity: number): void {
		// Spring force pulls joint back to rest (angle = 0)
		const springForce = -this.angle / this.stiffness;

		// Inertia: body rotation pushes joint in opposite direction
		const inertiaForce = -bodyAngularVelocity * dt * 30; // scaled to feel right

		this.angularVelocity += (springForce + inertiaForce);
		this.angularVelocity *= this.damping;
		this.angle += this.angularVelocity * dt;

		// Clamp to joint limits
		if (this.angle > this.limit) {
			this.angle = this.limit;
			this.angularVelocity = 0;
		} else if (this.angle < -this.limit) {
			this.angle = -this.limit;
			this.angularVelocity = 0;
		}
	}

	/** Apply a sudden impulse (e.g. on landing impact) */
	impulse(force: number): void {
		this.angularVelocity += force;
	}

	/** Reset to rest position */
	reset(): void {
		this.angle = 0;
		this.angularVelocity = 0;
	}
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/engine/SpringJoint.ts
git commit -m "feat: add SpringJoint class for limb physics"
```

---

### Task 3: Rewrite Slope with Catmull-Rom Spline

**Files:**
- Rewrite: `src/game/engine/Slope.ts`

- [ ] **Step 1: Rewrite Slope.ts**

Replace the entire file:

```typescript
// src/game/engine/Slope.ts
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
	private drawnUpToX = 0;

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
	initTerrain(startX: number, startY: number, finishX: number): void {
		this.controlPoints = [];
		this.finishX = finishX;
		this.drawnUpToX = 0;

		// Start with a flat-ish area before the launch
		this.controlPoints.push({ x: startX - 100, y: startY - 20 });
		this.controlPoints.push({ x: startX, y: startY });

		this.redraw();
	}

	/**
	 * Add a landing point from a bounce event.
	 * The spline will pass through this point exactly.
	 */
	addLandingPoint(x: number, y: number): void {
		// Avoid duplicate or out-of-order points
		const last = this.controlPoints[this.controlPoints.length - 1];
		if (last && x <= last.x) return;

		this.controlPoints.push({ x, y });
		this.redraw();
	}

	/**
	 * Finalize the terrain — add endpoint beyond finish line.
	 */
	finalize(): void {
		const last = this.controlPoints[this.controlPoints.length - 1];
		if (!last) return;

		// Extrapolate trend for finish area
		const prev = this.controlPoints[this.controlPoints.length - 2] || last;
		const slope = (last.y - prev.y) / Math.max(1, last.x - prev.x);
		const endX = this.finishX + 500;
		const endY = last.y + slope * (endX - last.x);
		this.controlPoints.push({ x: endX, y: endY });

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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/engine/Slope.ts
git commit -m "feat: rewrite Slope with Catmull-Rom spline through landing points"
```

---

### Task 4: Update Camera to KR-style

**Files:**
- Modify: `src/game/engine/Camera.ts`

- [ ] **Step 1: Rewrite Camera.ts**

Replace the entire file:

```typescript
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

	/**
	 * @param targetX - robot world X
	 * @param targetY - robot world Y
	 * @param slopeY - slope surface Y at robot's X position
	 */
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/engine/Camera.ts
git commit -m "feat: KR-style camera with 25% lerp and wider zoom range"
```

---

### Task 5: Integrate SpringJoint into Robot

**Files:**
- Modify: `src/game/engine/Robot.ts`

- [ ] **Step 1: Add SpringJoint imports and limb joint storage**

At the top of Robot.ts, add the import and extend `LimbSprite`:

```typescript
// Add after existing imports:
import { SpringJoint } from './SpringJoint';
import {
	SPRING_STIFFNESS_LIMB,
	SPRING_LIMIT_LIMB,
	SPRING_DAMPING_LIMB,
	LIMB_KICK_SPEED,
	LIMB_KICK_UP,
	LIMB_ANGULAR_VEL_MIN,
	LIMB_ANGULAR_VEL_MAX,
} from '../constants';

// Replace the LimbSprite interface:
interface LimbSprite {
	sprite: PIXI.Graphics;
	offsetX: number;
	offsetY: number;
	state: LimbState;
	isLeg: boolean;
	joint: SpringJoint;
}
```

- [ ] **Step 2: Update limb creation to include SpringJoint**

In the constructor, update `createArm` and `createLeg` to create joints:

```typescript
// Replace createArm closure:
const createArm = (id: LimbId, ox: number, oy: number): LimbSprite => {
	const sprite = new PIXI.Graphics();
	drawArm(sprite, armWidth, armLength, this.limbColor, accentColor);
	sprite.position.set(ox, oy);
	this.bodyGroup.addChild(sprite);
	const joint = new SpringJoint({
		stiffness: SPRING_STIFFNESS_LIMB,
		damping: SPRING_DAMPING_LIMB,
		limit: SPRING_LIMIT_LIMB,
	});
	return { sprite, offsetX: ox, offsetY: oy, state: 'intact', isLeg: false, joint };
};

// Replace createLeg closure:
const createLeg = (id: LimbId, ox: number, oy: number): LimbSprite => {
	const sprite = new PIXI.Graphics();
	drawSpring(sprite, this.legWidth, this.legLength, 1.0, this.limbColor);
	sprite.position.set(ox, oy);
	this.bodyGroup.addChild(sprite);
	const joint = new SpringJoint({
		stiffness: SPRING_STIFFNESS_LIMB,
		damping: SPRING_DAMPING_LIMB,
		limit: SPRING_LIMIT_LIMB,
	});
	return { sprite, offsetX: ox, offsetY: oy, state: 'intact', isLeg: true, joint };
};
```

- [ ] **Step 3: Add updateJoints method**

Add this method to the Robot class:

```typescript
/**
 * Update spring joints — call each frame from GameEngine.
 * @param dt - delta time in seconds
 * @param bodyAngularVelocity - current angular velocity of body (rad/s)
 */
updateJoints(dt: number, bodyAngularVelocity: number): void {
	for (const [id, limb] of this.limbs) {
		if (limb.state === 'detached') continue;

		limb.joint.update(dt, bodyAngularVelocity);

		// Apply joint angle to sprite rotation
		limb.sprite.rotation = limb.joint.angle;
	}
}

/** Apply landing impact impulse to all joint springs */
impactJoints(intensity: number): void {
	for (const [id, limb] of this.limbs) {
		if (limb.state === 'detached') continue;

		// Arms swing forward, legs absorb downward
		const direction = limb.isLeg ? -intensity : intensity;
		limb.joint.impulse(direction);
	}
}

/** Reset all joints to rest position */
resetJoints(): void {
	for (const [id, limb] of this.limbs) {
		limb.joint.reset();
	}
}
```

- [ ] **Step 4: Update detachLimb to use KR detach velocities**

Replace the `detachLimb` method:

```typescript
detachLimb(
	limbId: LimbId,
	parentContainer: PIXI.Container,
): { container: PIXI.Container; vx: number; vy: number; rotSpeed: number } | null {
	const limb = this.limbs.get(limbId);
	if (!limb || limb.state === 'detached') return null;

	limb.state = 'detached';
	this.bodyGroup.removeChild(limb.sprite);

	const detached = new PIXI.Container();
	const clone = limb.sprite.clone();
	detached.addChild(clone);
	detached.position.set(
		this.x + limb.offsetX * Math.cos(this.rotation),
		this.y + limb.offsetY * Math.sin(this.rotation),
	);

	parentContainer.addChild(detached);
	this.detachedLimbs.push(detached);

	// KR-style detach velocities
	const direction = limbId.startsWith('left_') ? -1 : 1;
	return {
		container: detached,
		vx: direction * LIMB_KICK_SPEED + (Math.random() - 0.5) * 60,
		vy: -(LIMB_KICK_UP + Math.random() * 100),
		rotSpeed: (LIMB_ANGULAR_VEL_MIN + Math.random() * (LIMB_ANGULAR_VEL_MAX - LIMB_ANGULAR_VEL_MIN)) * direction,
	};
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/engine/Robot.ts
git commit -m "feat: integrate SpringJoint into Robot limbs"
```

---

### Task 6: Rewrite GameEngine Physics

**Files:**
- Modify: `src/game/engine/GameEngine.ts`

This is the biggest change. We replace forward simulation with analytical trajectories, add spring joint updates, and use KR detach physics.

- [ ] **Step 1: Update imports and constants**

Replace the top of GameEngine.ts (lines 1-21):

```typescript
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

const ROBOT_OFFSET_Y = -30; // robot center offset above slope surface
```

- [ ] **Step 2: Replace physics state fields**

Replace the physics state section (lines 39-56) with:

```typescript
// --- Analytical trajectory state ---
private physicsActive = false;
// Starting point of current arc
private arcStartX = 0;
private arcStartY = 0;
// Computed initial velocities for the arc
private arcVx = 0;
private arcVy = 0;
// Flight timing
private flightElapsed = 0;
private flightDuration = 1;
// Spin tracking
private flightStartRotation = 0;
private completedSpins = 0;
private targetSpinCount = 0;
private targetLandingAngle = 0;
// Angular velocity (used only when targetSpinCount === 0 for gentle tumble)
private robotAngularVel = 0;
// Bounce waiting
private bounceResolve: (() => void) | null = null;
// Landing alignment
private pendingLandingType: string | null = null;
```

- [ ] **Step 3: Rewrite updatePhysics**

Replace the `updatePhysics` method entirely:

```typescript
private updatePhysics(dt: number): void {
	if (!this.physicsActive || !this.robot) return;

	this.flightElapsed += dt;
	const t = this.flightElapsed;

	// --- Analytical position (parabolic arc) ---
	this.robot.x = this.arcStartX + this.arcVx * t;
	this.robot.y = this.arcStartY + this.arcVy * t + 0.5 * KR_GRAVITY * t * t;

	// --- Rotation ---
	if (this.targetSpinCount > 0) {
		const progress = Math.min(1, t / this.flightDuration);
		const easedProgress = easeInOutCubic(progress);
		const totalRotation = this.targetSpinCount * Math.PI * 2 + this.targetLandingAngle;
		this.robot.setRotation(this.flightStartRotation + totalRotation * easedProgress);
	} else {
		this.robot.setRotation(this.robot.rotation + this.robotAngularVel * dt);
	}

	this.robot.container.position.set(this.robot.x, this.robot.y);

	// --- Spring joint update ---
	const bodyAngVel = this.targetSpinCount > 0
		? (this.targetSpinCount * Math.PI * 2) / this.flightDuration
		: this.robotAngularVel;
	this.robot.updateJoints(dt, bodyAngVel);

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

	// --- Landing detection (time-based, not collision) ---
	if (t >= this.flightDuration) {
		// Snap to exact landing position
		this.robot.x = this.arcStartX + this.arcVx * this.flightDuration;
		this.robot.y = this.arcStartY + this.arcVy * this.flightDuration
			+ 0.5 * KR_GRAVITY * this.flightDuration * this.flightDuration;

		// Snap to landing angle
		if (this.pendingLandingType) {
			this.robot.setRotation(LANDING_ANGLES[this.pendingLandingType] ?? 0);
			this.pendingLandingType = null;
		}

		this.robot.container.position.set(this.robot.x, this.robot.y);
		this.physicsActive = false;

		// Impact impulse on springs
		this.robot.impactJoints(2);

		if (this.bounceResolve) {
			this.bounceResolve();
			this.bounceResolve = null;
		}
	}
}
```

- [ ] **Step 4: Remove getLandingAngle method**

Delete the `getLandingAngle` method (lines 226-235 in original) — replaced by `LANDING_ANGLES` constant lookup.

- [ ] **Step 5: Rewrite updateHeadPhysics to use analytical trajectory**

Replace the `updateHeadPhysics` method:

```typescript
// Head catapult — also analytical
private headArcStartX = 0;
private headArcStartY = 0;
private headArcVx = 0;
private headArcVy = 0;
private headFlightElapsed = 0;
private headFlightDuration = 1;
private headAngularVel = 0;

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
		// Snap to exact position
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
```

- [ ] **Step 6: Rewrite updateDetachedLimbs with KR air drag**

Replace `updateDetachedLimbs`:

```typescript
private updateDetachedLimbs(dt: number): void {
	for (let i = this.detachedLimbs.length - 1; i >= 0; i--) {
		const limb = this.detachedLimbs[i];

		// Gravity
		limb.vy += KR_GRAVITY * dt;

		// Air drag: 0.3% per 30ms tick, frame-rate independent
		const dragFactor = Math.pow(1 - KR_AIR_DRAG, dt * KR_TICK_RATE);
		limb.vx *= dragFactor;
		limb.vy *= dragFactor;

		// Move
		limb.container.position.x += limb.vx * dt;
		limb.container.position.y += limb.vy * dt;
		limb.container.rotation += limb.rotSpeed * dt;

		// Fade out
		limb.container.alpha -= dt * LIMB_FADE_RATE;

		if (limb.container.alpha <= 0) {
			this.worldContainer.removeChild(limb.container);
			limb.container.destroy({ children: true });
			this.detachedLimbs.splice(i, 1);
		}
	}
}
```

- [ ] **Step 7: Update setupRound to initialize spline terrain**

Replace `setupRound`:

```typescript
async setupRound(event: BookEventGameStart): Promise<void> {
	if (this.robot) this.robot.destroy();

	// Spin the wheel to selected robot
	if (this.robotWheel) {
		this.robotWheel.setVisible(true);
		await this.robotWheel.selectRobot(event.robot);
	}

	// Initialize terrain with start point
	if (this.slope) {
		const startY = 60 * 1.0; // initial slope position (approximate)
		this.slope.initTerrain(0, startY, event.finishX);
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
```

- [ ] **Step 8: Update startKick to compute analytical arc**

Replace `startKick`:

```typescript
async startKick(event: BookEventKick): Promise<void> {
	if (!this.robot) return;

	if (this.robotWheel) this.robotWheel.setVisible(false);
	if (this.kicker) await this.kicker.kick();

	// For the initial kick, we don't know the landing point yet.
	// Use forward simulation until the first bounce event provides coordinates.
	// Store current position as arc start; velocity from event.
	this.arcStartX = this.robot.x;
	this.arcStartY = this.robot.y;

	const vx = event.initialVx * 30; // VEL_SCALE
	const vy = event.initialVy * 30;

	// Estimate flight time: when will robot hit slope?
	// Simple estimate: solve y + vy*t + 0.5*g*t^2 = slopeY(x + vx*t)
	// Approximate with a 45° slope: landing after ~1.5s
	this.flightDuration = 2.0; // will be corrected by first bounce event
	this.arcVx = vx;
	this.arcVy = vy;

	this.robotAngularVel = event.initialVx * 0.3;
	this.targetSpinCount = 0;
	this.targetLandingAngle = 0;
	this.flightStartRotation = this.robot.rotation;
	this.completedSpins = 0;
	this.flightElapsed = 0;
	this.physicsActive = true;
}
```

- [ ] **Step 9: Update waitForBounce — recalculate arc to land at exact point**

Replace `waitForBounce`:

```typescript
async waitForBounce(event: BookEventBounce): Promise<void> {
	if (!this.robot) return;

	this.pendingLandingType = event.landedOn;

	// Add landing point to spline terrain
	if (this.slope) {
		this.slope.addLandingPoint(event.positionX, event.slopeY);
	}

	if (!this.physicsActive) return;

	// Recalculate the arc to land exactly at the event's position.
	// We know where we are NOW and where we need to land.
	const currentX = this.robot.x;
	const currentY = this.robot.y;
	const targetX = event.positionX;
	const targetY = event.slopeY + ROBOT_OFFSET_Y;

	// Remaining flight time = total airTime minus what we've already flown
	// But for the first kick, airTime isn't available directly.
	// Use event.airTime as the TOTAL flight time for this segment.
	const remainingTime = Math.max(0.3, event.airTime - this.flightElapsed);

	// Recompute arc from current position to target
	this.arcStartX = currentX;
	this.arcStartY = currentY;
	this.arcVx = (targetX - currentX) / remainingTime;
	this.arcVy = (targetY - currentY - 0.5 * KR_GRAVITY * remainingTime * remainingTime) / remainingTime;
	this.flightDuration = remainingTime;
	this.flightElapsed = 0;

	// Update spin tracking for remaining flight
	this.flightStartRotation = this.robot.rotation;
	this.targetSpinCount = event.spinCount;
	this.targetLandingAngle = LANDING_ANGLES[event.landedOn] ?? 0;
	this.completedSpins = 0;

	// Wait for time-based landing
	return new Promise<void>((resolve) => {
		this.bounceResolve = resolve;
	});
}
```

- [ ] **Step 10: Update launchFromBounce — analytical arc for next segment**

Replace `launchFromBounce`:

```typescript
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

	// Set up analytical arc for the next bounce.
	// We launch from current position. The NEXT bounce event will call
	// waitForBounce() which recalculates the arc to the landing point.
	// For now, use launchVx/Vy as initial direction.
	this.arcStartX = this.robot.x;
	this.arcStartY = this.robot.y;
	this.arcVx = event.launchVx * 30; // VEL_SCALE
	this.arcVy = event.launchVy * 30;

	// Estimate flight duration (will be corrected by next waitForBounce)
	this.flightDuration = Math.max(0.5, event.airTime);

	this.flightStartRotation = this.robot.rotation;
	this.completedSpins = 0;
	this.flightElapsed = 0;
	this.targetSpinCount = event.spinCount;
	this.targetLandingAngle = 0; // will be set by next waitForBounce

	if (event.spinCount <= 0) {
		if (event.landedOn !== 'both_feet') {
			this.robotAngularVel = ((Math.random() - 0.5) * 3) + (event.launchVx > 0 ? 1 : -1);
		} else {
			this.robotAngularVel = (Math.random() - 0.5) * 0.8;
		}
	} else {
		this.robotAngularVel = 0;
	}

	this.physicsActive = true;
}
```

- [ ] **Step 11: Update playHeadCatapult — analytical arc**

Replace `playHeadCatapult`:

```typescript
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

	// If we know the landing X, compute exact arc
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
```

- [ ] **Step 12: Update the animate trail to use analytical velocity**

In the `animate` method, update the trail particle section:

```typescript
// Trail particles while flying
if (this.robot && this.physicsActive && this.effects) {
	const speed = Math.sqrt(this.arcVx ** 2 + (this.arcVy + KR_GRAVITY * this.flightElapsed) ** 2);
	if (speed > 50) {
		this.effects.spawnTrail(this.robot.x, this.robot.y, speed * 0.01);
	}
}
```

- [ ] **Step 13: Remove old head physics fields**

Remove the old head physics fields (headVx, headVy, headAngularVel) since they're replaced by headArc* fields. The new fields are declared in Step 5.

- [ ] **Step 14: Add finalize call to slope**

Add a `finalizeTerrain` public method:

```typescript
finalizeTerrain(): void {
	if (this.slope) this.slope.finalize();
}
```

- [ ] **Step 15: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 16: Commit**

```bash
git add src/game/engine/GameEngine.ts
git commit -m "feat: analytical trajectory physics with spring joints and KR gravity"
```

---

### Task 7: Update bookEventHandlerMap for Terrain Building

**Files:**
- Modify: `src/game/bookEventHandlerMap.ts`

- [ ] **Step 1: Add terrain finalization on final bounces**

In the `bounce` handler, after the crash handling and before the launch, add terrain finalization when the robot reaches the finish:

```typescript
// In the bounce handler, replace the launch section at the bottom (lines 92-95):

// Finalize terrain when we reach the finish area
if (event.positionX >= stateGame.finishX && engine) {
	engine.finalizeTerrain();
}

// Launch to next bounce — but NOT if we've reached/passed the finish
if (engine && event.positionX < stateGame.finishX) {
	await engine.launchFromBounce(event);
}
```

- [ ] **Step 2: Add terrain finalization on head catapult**

In the `headCatapult` handler, finalize terrain before playing the catapult:

```typescript
// In headCatapult handler, after getting engine:
engine?.finalizeTerrain();
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/bookEventHandlerMap.ts
git commit -m "feat: pass bounce landing points to terrain and finalize on completion"
```

---

### Task 8: Integration Test & Visual Tuning

**Files:**
- All modified files

- [ ] **Step 1: Run the full build**

Run: `npm run build` (or the project's build command)
Expected: Builds without errors.

- [ ] **Step 2: Run the dev server and play a round**

Run: `npm run dev`

Verify:
1. Robot launches from kicker
2. Terrain is curved (not a straight 45-degree line)
3. Robot follows a smooth parabolic arc
4. Limbs swing/bounce during flight rotation
5. Robot lands exactly at impact points (no drift)
6. Spin notifications appear mid-flight
7. Camera follows smoothly with dynamic zoom
8. Limb detachment flings parts with proper physics
9. Head catapult arc is smooth

- [ ] **Step 3: Tune constants if needed**

If arcs look too flat/steep, adjust `KR_GRAVITY` in constants.ts. Higher = steeper arcs.

If limbs are too floppy/stiff, adjust `SPRING_STIFFNESS_LIMB` and `SPRING_DAMPING_LIMB`.

If camera is too fast/slow, adjust `CAMERA_LERP_RETENTION` (lower = faster tracking).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Kamikaze Robots physics integration"
```
