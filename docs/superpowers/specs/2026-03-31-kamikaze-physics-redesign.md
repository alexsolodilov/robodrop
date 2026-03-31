# Kamikaze Physics Redesign

Redesign Robo Drop's physics engine to match the visual feel of Kamikaze Robots while keeping the inverse-kinematics approach (book events determine outcomes, frontend calculates trajectories backwards).

## Goals

- Robot trajectories look physically convincing with proper gravity and air resistance
- Limbs swing and bounce realistically during flight (spring joints)
- Terrain is a dynamic curve, not a straight 45-degree line
- Camera feels responsive and cinematic
- Zero changes to server/RGS — client adapts to existing book events

## Non-Goals

- Forward physics simulation (causes desync with book events)
- Full ragdoll/IK system (too complex for the visual payoff)
- Server-side terrain generation
- Changes to RTP, penalties, or game logic

---

## 1. Analytical Trajectory (Inverse Kinematics)

### Current

Forward Euler integration: `robotVy += GRAVITY * dt`, position accumulated each frame. Robot may not land exactly at the server-specified point due to floating-point drift.

### New

Given a bounce event with `start(x,y)`, `end(positionX, slopeY)`, `airTime`, and `spinCount`, compute the trajectory analytically:

```typescript
// Initial velocities (computed once at launch)
const vx = (endX - startX) / airTime;
const vy = (endY - startY - 0.5 * GRAVITY * airTime * airTime) / airTime;

// Each frame (t = elapsed time since launch)
robot.x = startX + vx * t;
robot.y = startY + vy * t + 0.5 * GRAVITY * t * t;
```

The robot lands exactly at `(endX, endY)` when `t >= airTime`. No drift, no correction needed.

### Gravity Constant

Change from 400 to **800 px/s**. This is purely aesthetic — higher gravity means steeper arcs and faster falls, matching the Kamikaze Robots feel. The exact value is tunable since trajectories are analytical (gravity only affects arc shape, not landing point — `vy` is recalculated to compensate).

### Rotation

Eased rotation through `spinCount` full turns plus a landing angle offset:

```typescript
const landingAngles = {
  both_feet: 0,
  one_leg: 0.15 * Math.PI,
  arm: 0.5 * Math.PI,
  body: 0.7 * Math.PI,
  head: Math.PI,
};

const totalRotation = spinCount * 2 * Math.PI + landingAngles[landedOn];
const progress = easeInOutCubic(t / airTime);
robot.rotation = startAngle + totalRotation * progress;
```

This is close to the current implementation but replaces the forward spin accumulation with a purely analytical approach.

### Air Resistance (Visual Only)

Applied to detached limbs only (not the main trajectory, which is analytical):
- Drag: 0.3% velocity loss per 30ms tick (from KR: `vel *= 1 - 3/1024`)
- At 60fps: `vel *= (1 - 0.003) ^ (dt / 0.03)`

---

## 2. Dynamic Terrain (Spline Through Landing Points)

### Current

Straight 45-degree slope: `y = x * 1.0 + sin(x*0.05)*8 + sin(x*0.13)*4`.

### New

Terrain is a **Catmull-Rom spline** passing through bounce landing points.

**Construction:**

1. Collect landing coordinates `(positionX, slopeY)` from bounce events
2. Add a start point at the robot's initial position
3. Add an end point at the finish line (extrapolate slope trend)
4. Build Catmull-Rom spline through all points
5. Add small sinusoidal noise between control points for surface texture

**If events arrive one at a time:**

Generate terrain in chunks. When a new bounce event arrives:
- We know the current position and the next landing point
- Extend the spline to include the new point
- The terrain ahead of the camera (not yet visible) can be a straight extrapolation until the next point is known

**Collision function:**

`getSlopeYAtX(x)` interpolates the spline instead of computing `x * slope + bumps`.

**Visual rendering:**

Same style as current — dark filled polygon below the curve, light edge highlight, scattered rocks — but the curve now bends and varies in steepness.

---

## 3. Spring Joint Limbs

### Current

Limbs are rigidly attached to the body at fixed offsets. On detach, they get basic gravity + alpha fadeout.

### New

Each limb has a `SpringJoint` that simulates angular lag during rotation.

**SpringJoint state:**
```typescript
interface SpringJoint {
  angle: number;         // current joint angle relative to body
  angularVelocity: number;
  stiffness: number;     // spring constant (lower = bouncier)
  damping: number;       // velocity damping per tick
  limit: number;         // max deflection in radians
}
```

**Update per frame:**
```typescript
const targetAngle = 0; // rest position
const springForce = (targetAngle - joint.angle) / joint.stiffness;
joint.angularVelocity += springForce;
joint.angularVelocity *= joint.damping;
joint.angle += joint.angularVelocity * dt;
joint.angle = clamp(joint.angle, -joint.limit, joint.limit);
```

When the body rotates, the inertia of the limbs causes them to lag behind, creating a natural swinging motion.

**Parameters (from KR):**

| Limb | Stiffness | Limit | Damping |
|------|-----------|-------|---------|
| Arms | 60 | 53 deg (0.93 rad) | 0.95 |
| Legs | 60 | 53 deg | 0.95 |
| Hands/Feet | 40 (stiffer) | 74 deg (1.29 rad) | 0.93 |

These are starting values — will need visual tuning.

**On landing impact:**

- Legs: compress springs (current `compressLegs()` behavior) + spring joints jolt
- Arms: swing forward from deceleration impulse

**On limb detach (from KR):**

```typescript
detachedLimb.vx = bodyVx + kickVelocity; // kick ≈ 4 px/frame at 60fps
detachedLimb.vy = bodyVy - random(50, 100); // upward kick
detachedLimb.angularVelocity = 1500 + random(0, 1023); // in KR units
// Convert KR units: angVel / 1024 * 2PI * 33fps ≈ 3-5 rad/s
detachedLimb.angularVelocity = 3 + Math.random() * 2; // rad/s
```

Detached limbs: gravity + air drag (0.3%/tick) + angular velocity + alpha fadeout.

---

## 4. Camera

### Current

- Follow: 8% lerp (`FOLLOW_SMOOTH = 0.08`)
- Zoom: 0.7x–1.8x based on height above slope, threshold 250px
- Screen shake on bad landings

### New

**Follow speed:**
- KR uses 25% lerp per tick at 33fps
- At 60fps, frame-rate independent: `lerpFactor = 1 - Math.pow(0.75, dt * 33)`
- This is roughly 3x faster than current — camera tracks robot more tightly

**Look-ahead:**
- Target offset: `targetY -= heightAboveSlope * 0.25` (look slightly above robot)
- No horizontal look-ahead (KR doesn't use it)

**Zoom:**
- Wider range: 0.5x (very high) to 1.8x (on ground)
- Height threshold: 400px for full zoom-out (was 250px)
- Zoom lerp: same 25% as position — smooth, no jumps
- Frame-rate independent: `zoomLerp = 1 - Math.pow(0.75, dt * 33)`

**Screen shake:** unchanged — current implementation works well.

---

## 5. Constants

New constants file values (replacing/extending current):

```typescript
// Trajectory
const GRAVITY = 800;              // px/s² (was 400, purely aesthetic)

// Air resistance (detached limbs only)
const AIR_DRAG_PER_TICK = 0.003;  // 0.3% per 30ms tick
const TICK_RATE = 33;             // KR physics rate for unit conversion

// Spring joints
const SPRING_STIFFNESS_LIMB = 60;
const SPRING_STIFFNESS_EXTREMITY = 40;
const SPRING_LIMIT_LIMB = 0.93;   // radians (~53 deg)
const SPRING_LIMIT_EXTREMITY = 1.29; // radians (~74 deg)
const SPRING_DAMPING_LIMB = 0.95;
const SPRING_DAMPING_EXTREMITY = 0.93;

// Limb detach
const LIMB_KICK_SPEED = 4;        // px/frame base
const LIMB_ANGULAR_VEL_MIN = 3;   // rad/s
const LIMB_ANGULAR_VEL_MAX = 5;   // rad/s

// Camera
const CAMERA_LERP_BASE = 0.75;    // per-tick retention (25% lerp)
const CAMERA_LERP_RATE = 33;      // reference tick rate
const ZOOM_NEAR = 1.8;
const ZOOM_FAR = 0.5;
const ZOOM_HEIGHT_THRESHOLD = 400; // px above slope for full zoom-out

// Landing angles
const LANDING_ANGLES = {
  both_feet: 0,
  one_leg: 0.15 * Math.PI,
  arm: 0.5 * Math.PI,
  body: 0.7 * Math.PI,
  head: Math.PI,
};
```

---

## 6. File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `GameEngine.ts` | **Rewrite** `updatePhysics()` | Analytical trajectory, spring joint updates |
| `Slope.ts` | **Rewrite** | Catmull-Rom spline terrain, dynamic construction |
| `Camera.ts` | **Modify** | 25% lerp, wider zoom range, look-ahead |
| `SpringJoint.ts` | **New** | Spring joint model for limb physics |
| `Robot.ts` | **Modify** | Integrate SpringJoint, update limb rendering from joint angles |
| `bookEventHandlerMap.ts` | **Modify** | Pass landing points to Slope for terrain construction |
| `constants.ts` | **Modify** | Add KR-derived constants |
| `Effects.ts` | No change | Particles work as-is |
| `Background.ts` | No change | Sky/mountains unchanged |
| `Kicker.ts` | No change | Launch mechanism unchanged |
| `stateGame.svelte.ts` | No change | State management unchanged |
| `config.ts` | No change | RTP/penalty logic unchanged |
| `typesBookEvent.ts` | No change | Server types unchanged |
| Svelte components | No change | UI unchanged |
