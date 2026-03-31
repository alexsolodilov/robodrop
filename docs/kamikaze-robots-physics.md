# Kamikaze Robots — Extracted Physics Engine

Decompiled from `KamikazeRobots_s40v3a.jar` (Nokia S40 J2ME game, class `DCBolt`).
All code uses **fixed-point integer arithmetic**. No floating point.

---

## 1. Fixed-Point Conventions

| Scale | Usage |
|-------|-------|
| `<< 8` (256) | Position coordinates, angles stored as `angle << 8` |
| `1024` | Trig values: sin/cos return [-1023..1023] where 1023 ≈ 1.0 |
| `1024 angle units` | Full circle = 1024 units (not radians, not degrees) |

**To convert to real numbers:**
- Position: `value / 256` = pixels
- Trig: `value / 1024` ≈ real number
- Angle: `value * 360 / 1024` = degrees, or `value * 2π / 1024` = radians

---

## 2. Trigonometry Lookup Tables

### Sin/Cos Table (`b[]`, 1024 entries)

Generated procedurally using CORDIC-like iteration:

```
table[0] = 1023    (cos 0 = 1.0)
table[256] = 0     (cos 90° = 0)
table[512] = -1023 (cos 180° = -1.0)
table[768] = 0     (cos 270° = 0)
```

**Lookup functions:**
- `cos(n) = b[256 - n & 0x3FF]` — shifted by 90° (quarter period)
- `sin(n) = b[n & 0x3FF]`

Both take angle in 1024-unit circle (0..1023), return fixed-point [-1023..1023].

### Integer Square Root (`t(n)`)

Uses a 256-entry lookup table `a[]` with Newton's method refinement.
Supports values up to `0x40000000`.

---

## 3. Physics Update Loop

**Frame rate:** Fixed timestep of **30ms** per physics tick (≈33 FPS).

```
// In s(int deltaTime):
while (accumulatedTime < currentTime) {
    accumulatedTime += 30;  // 30ms per tick
    h();                    // update all entities
    i();                    // update stats (max rotation, speed, height)
    j();                    // update camera
}
```

### Per-Entity Update (`m(int entityIndex)`)

Each physics tick, for each active entity:

```
1. n(joints)     — check joint detachment conditions
2. k(entity)     — propagate parent position/velocity to attached children
3. angle += angularVelocity    (f[n+4] += f[n+5])
4. p(entity)     — apply velocity, gravity, air resistance
5. j(entity)     — update joint positions based on body rotation
6. t(entity)     — AI-controlled angular velocity (for type=1 body only)
7. Check collisions with limb-specific attachment points
```

---

## 4. Core Physics: Position & Velocity

### Integration (`p(int n)`)

```java
// Position integration (Euler)
f[n+0] += f[n+2];     // x += vx
f[n+1] += f[n+3];     // y += vy

// Gravity (pulling DOWN = negative Y in this coordinate system)
f[n+3] -= 82;         // vy -= 82 per tick

// Air resistance (0.29% velocity loss per tick)
f[n+2] -= f[n+2] * 3 / 1024;   // vx *= (1 - 3/1024) ≈ 0.9971
f[n+3] -= f[n+3] * 3 / 1024;   // vy *= 0.9971
```

**Converting to real units:**
- Gravity: 82 per tick at 33fps = **82 × 33 = 2706 units/sec²**
- In pixels: **2706 / 256 ≈ 10.6 px/sec²** (feels like ~1g at game scale)
- Air resistance: ~0.3% per 30ms tick → **~10% per second**

### Coordinate System
- **X increases right** (horizontal distance)
- **Y increases UP** (terrain height Y > 0 is above ground)
- Terrain function returns Y at given X
- Entity below terrain when `f[n+1] < terrainHeight(f[n+0])`

---

## 5. Terrain / Slope

### Terrain Height Function (`f(int segmentIndex)`)

Procedurally generated per-segment using a seeded hash function (`-1644122275` magic constant = LCG multiplier).

```java
// Parameters:
// v = baseSlope       (negative = downhill)
// w = slopeVariation  (randomness amplitude)
// x = noiseAmplitude  (small bumps)
// t = seed            (v + w * x)
// y = segmentWidth    (in world units)

int baseHeight = -segmentIndex * v;  // linear downhill slope
int variation = hash(segmentIndex) * w / 256;  // random variation
int noise = hash2(segmentIndex) * x / 256;     // fine noise
return baseHeight + variation + noise - 300;
```

First 2 segments are flat (launch area).

### Interpolated Height at Any X (`g(int worldX)`)

Linear interpolation between segment endpoints:
```java
int seg = (worldX >> 8) / segmentWidth;
int frac = worldX - seg * segmentWidth * 256;
int h1 = f(seg);
int h2 = f(seg + 1);
return (h1 + (h2 - h1) * frac / segmentWidth) << 8;
```

### Slope Normal Calculation (`q(int worldX)`)

```java
// Compute tangent vector between segment endpoints
int dx = (segmentWidth << 8) >> 8;   // = segmentWidth
int dy = (h2 - h1) >> 8;
int len = sqrt(dx*dx + dy*dy) | 1;   // never zero

// Unit tangent (8-bit fixed-point)
aa = (dx << 8) / len;   // tangent X
ab = (dy << 8) / len;   // tangent Y
// Normal = (-ab, aa) perpendicular to slope
```

### Signed Distance from Slope (`j(int entity)`)

```java
int dx = position.x - segmentStart.x;
int dy = position.y - segmentStart.y;
return (dy * tangentX - dx * tangentY) >> 8;
// negative = below slope = collision!
```

### Velocity Components Relative to Slope

```java
// Along slope (tangential): k(entity)
velocityAlongSlope = vx * tangentX + vy * tangentY >> 8;

// Perpendicular to slope (normal): l(entity)
velocityNormalToSlope = vy * tangentX - vx * tangentY >> 8;
```

---

## 6. Collision & Bounce

### Detection

When `entity.y < terrainHeight(entity.x)` (entity below ground):

```java
int penetration = j(entity);         // signed distance (negative = below)
int velAlongSlope = k(bodyEntity);   // tangential velocity
int velNormalSlope = l(bodyEntity);   // normal velocity (negative = moving into ground)

if (velNormalSlope < 0) {
    // COLLISION! Process bounce
}
```

### Bounce Response (Line 5146-5282)

```java
// 1. Push entity back to surface
d(bodyEntity, 0, -penetration);   // move along slope normal

// 2. Apply bounce velocity
e(bodyEntity,
  -velAlongSlope * 180 / 256,     // tangential: friction = 180/256 ≈ 0.703 (reverse + scale)
  -velNormal - (velNormal * 255 / 255) + 1280  // normal: reflect + constant bounce = 1280
);
```

**Bounce coefficients:**
- **Tangential friction:** 180/256 ≈ **0.703** (energy preserved along slope)
  - Velocity reversed and scaled: `newVt = -vt * 0.703`
- **Normal restitution:** essentially **~0** elastic + constant upward kick
  - `newVn = -vn - vn + 1280` → simplifies to: `-2*vn + 1280`
  - But the `255/255` is just 1.0, so: `newVn = -2*velNormal + 1280`
  - The **1280** is a constant bounce force (~5 pixels/tick velocity)

### Body Part Damage on Landing

**Landing body part determined by which joint/attachment touches ground first.**

Each body part has a `type` field (`f[n+6]`):

| Type | Body Part | Detach Threshold | Health Penalty | Notes |
|------|-----------|-----------------|----------------|-------|
| 1 | Body/Torso | health < 0 | -210 | Game over if health reaches 0 |
| 2 | Head | state=6 (dead) | -310 | Instant kill if n7==5, sets state=6 |
| 3 | Left Arm | health < 700 | -230 (arm), sets speed=0 | Detaches, adds random angular velocity |
| 4 | Right Arm | health < 1000 | -230 (arm) | Same as left arm |
| 5 | Left Leg | health < 350 | -110 (leg) | Leg bounce gives flip bonus |
| 6 | Right Leg | health < 0 | -110 (leg) | Similar to left leg |
| 7 | Left Hand/Foot | attached to arm | — | Attached via arm joint |
| 8 | Right Hand/Foot | attached to arm | — | Attached via arm joint |

**When a limb detaches:**
```java
f[joint+11] = 0;              // mark as detached
f[joint+2] += 1000;           // kick velocity
f[joint+5] += 1500 + random(0..1023);  // random angular velocity
// Limb becomes independent physics object
```

### Leg Landing (Types 5, 6) — Flip Bonus

```java
int rotation = h(entity);              // total rotation since last bounce (in 1024 units)
B += rotation * 360 / 1024;           // accumulate total flip degrees
int speedBonus = 12 * rotation / 1024; // speed bonus from flips

// Additional bonus if flag set
if (hasSpeedFlag) speedBonus += 20;

int totalBoost = (baseSpeed + speedBonus) << 6;
// Apply boost in body's facing direction
vx += totalBoost * cos(angle) / 1024;
vy += totalBoost * sin(angle) / 1024;
```

---

## 7. Robot Entity Structure

### Entity Array Layout (`f[]`)

Each entity occupies a variable-length block starting at `e[entityIndex]`:

| Offset | Field | Description |
|--------|-------|-------------|
| 0 | posX | X position (fixed-point << 8) |
| 1 | posY | Y position (fixed-point << 8) |
| 2 | velX | X velocity |
| 3 | velY | Y velocity |
| 4 | angle | Rotation angle (stored << 8, in 1024-unit circle) |
| 5 | angVel | Angular velocity |
| 6 | type | Entity type (1=body, 2=head, 3=leftArm, 4=rightArm, 5=leftLeg, 6=rightLeg, 7=leftHand, 8=rightHand) |
| 7 | flags | Bit flags: 0x01=hidden, 0x02=hasJoints, 0x08=hasSprite, 0x10=speedBonus |
| 8 | jointCount | Number of attachment joints |
| 9 | constraintCount | Number of constraints |
| 10 | parentIndex | Parent entity index |
| 11 | attachmentRef | Joint attachment reference (0 = detached) |
| 12 | health | Health/integrity (starts at 1200-3000 depending on config) |
| 13 | baseSpeed | Base forward speed |
| 14 | maxAngVel | Maximum angular velocity |
| 15 | limbLength | Length of limb (for detachment physics) |
| 16 | ownerType | 1=player, 2=obstacle, 3=detached limb, 4=AI |
| 17 | spriteIndex | Which sprite set to use |
| 18 | lastBounceTime | Frame number of last bounce |
| 19 | distanceTraveled | Accumulated distance |
| 20 | lastAngle | Angle at start of current jump (for rotation counting) |
| 21-22 | jointPosXY | Joint visual position (for arms/legs) |
| 25 | jointOffset | Joint angle offset |
| 26 | jointAngle | Computed joint angle |
| 27 | parentAngle | Parent body angle |
| 28-29 | childRefs | References to child entities |
| 30 | state | 0=normal, 4=bouncing, 5=detaching, 6=dead |
| 31+ | joints[] | Joint data (9 ints per joint) |

### Robot Assembly (9 body parts)

Created in `a(int pos, int type, int health, int speed, int maxSpeed, int maxAngVel, int sprite)`:

```
Body (type=1): hexagonal shape, 7 attachment points
  ├── Head (type=2): 4 vertices, square shape, offset (0, 38)
  ├── Left Arm (type=3): 4 vertices + 1 joint, offset (-12, 10)
  │   └── Left Hand (type=7): attached to arm end
  ├── Right Arm (type=4): 4 vertices + 1 joint, offset (17, 10)
  │   └── Right Hand (type=8): attached to arm end
  ├── Left Leg (type=5): 4 vertices, offset (-13, -36)
  └── Right Leg (type=6): 4 vertices, offset (13, -36)
```

Vertex positions (relative to entity center, in game units):
- **Body:** (10,0), (20,0), (10,20), (-10,20), (-20,0), (-10,-20), (10,-20)
- **Head:** (-7,-7), (-7,7), (7,7), (7,-7) — square
- **Arms:** (-10,-3), (-10,3), (10,3), (10,-3) — horizontal rectangle
- **Legs:** (5,-10), (-5,-10), (-5,10), (5,10) — vertical rectangle

---

## 8. Joint System

### Joint Position Update (`j(int entity)`)

Joints rotate with the parent body:
```java
int angle = entity.angle >> 8 & 0x3FF;
int sinA = sin(angle);
int cosA = cos(angle);

for each joint:
    // Rotate local offset by body angle
    int worldX = localX * sinA + localY * cosA >> 10;
    int worldY = localY * sinA - localX * cosA >> 10;
    joint.posX = entity.posX + worldX;
    joint.posY = entity.posY + worldY;
    
    // Joint velocity = body velocity + rotational component
    joint.velX = entity.velX + worldY * (-angVel >> 8) >> 10;
    joint.velY = entity.velY + worldX * (-angVel >> 8) >> 10;
```

### Limb IK (Arms/Legs, `a(x, y, angle, offset, entity)`)

Arms and legs track their attachment point with spring-like behavior:
```java
int targetAngle = bodyAngle + offset + limbAngle;
int error = (targetY - currentY);  // distance from target

// Spring constant depends on limb type
int springForce = error / 60;   // normal limbs
int springForce = error / 40;   // hands/feet (stiffer)

// Apply angular correction
if (not at limit) {
    angularOffset += springForce;
}
// Clamp to joint limits
// Arms: ±150
// Hands/Feet: ±210
```

---

## 9. Angular Velocity / Rotation Control

### Player-Controlled Rotation (`t(int entity)`)

For `type=1` (player body):
```java
int angVel = f[entity + 5];
int input = playerKeyState;    // bit 8 = pressing left/right

if (pressing key) {
    angVel += -4000;  // strong counter-rotation
} else {
    angVel += 150;    // default spin acceleration (u = 150..200)
}

// Clamp
if (angVel < -1900) angVel = -1900;
if (angVel > maxAngVel) angVel = maxAngVel;
```

For `type=2` (head, detached):
```java
// Auto-stabilization: tries to keep upright
int height = (posY - terrainHeight) * 5/4;
int currentAngle = (angle >> 8) & 1023;
int targetAngle = 139;  // roughly upright

if (height > threshold || angle far from target) {
    angVel += -6000;   // strong correction
} else if (angle < target && angVel > 300) {
    angVel += -6000;   // slow down
} else if (angle > target && angVel > 0) {
    angVel += -6000;
} else {
    angVel += 150;     // gentle spin
}
clamp(angVel, -1200, maxAngVel);
```

---

## 10. Game Statistics (`y[]` array)

| Index | Stat | Unit |
|-------|------|------|
| 0 | Distance traveled | world units |
| 1 | Total rotation | 1024-units (divide by 1024 for full rotations) |
| 2 | Bounce count | integer |
| 3 | ? | |
| 4 | ? | |
| 5 | ? | divided by 10 for display |
| 6 | ? | divided by 10 for display |
| 7 | Limbs lost | integer |
| 8 | Games played | integer |

### Game State Tracking

```java
K = entity.posX >> 8;  // current X position (pixels)
J = finishLineX;       // level end X position
N = 1 + countAliveEntities();  // number of robots ahead

// Game end conditions:
if (N == 1 && K > J) → WIN (state 8 or 9)
if (state == 6) → DEAD (all robots ahead, or crashed)
```

---

## 11. Particle System

### Dust Particles on Bounce

```java
b(posX, posY, 3, 0);    // type 0 = dust
b(posX, posY, 3, 2);    // type 2 = sparks

// Leg bounce with enough rotation (>360°):
f(posX, posY, boostAmount);   // boost trail particles
c(posX, posY, boostAmount, 0); // impact particles
```

### Limb Detachment Particles

```java
b(posX, posY, 1024, 0, 1);  // large explosion effect, 1024 = big radius
c(limbPos - limbVel, 3000, 1);  // trailing sparks, vel=3000
```

---

## 12. Camera System

```java
// Camera follows player with damping
int targetX = entity.posX;
int targetY = entity.posY - height/4;  // slightly above

cameraX += (targetX - cameraX) >> 2;   // 25% lerp per frame
cameraY += (targetY - cameraY) >> 2;

// Zoom based on height above ground
int minZoom = 11520 * screenH / baseScreenH;
int maxZoom = minZoom * 2;
int targetZoom = clamp(heightAboveGround * 2, minZoom, maxZoom);
zoom += (targetZoom - zoom) >> 2;
```

### World-to-Screen Transform

```java
screenX = (worldX - cameraX + viewWidth/2) * screenWidth / viewWidth;
screenY = screenHeight - (worldY - cameraY + viewHeight/2) * screenHeight / viewHeight;
```

---

## 13. Level Configuration

29 levels loaded from resource data, each with 16 parameters:

```
a[level][0]  = ?
a[level][6]  = finishLineX (course length)
a[level][7]  = baseSlope (v) - how steep the hill is
a[level][8]  = slopeVariation (w) - randomness of terrain
a[level][9]  = noiseAmplitude (x) - small bumps
a[level][10] = targetHeight (for height achievement)
a[level][11] = targetSpeed (for speed achievement)
a[level][12] = targetRotation (for flip achievement)
a[level][13] = opponentStartOffset
a[level][14] = obstacleCount
a[level][15] = spriteTheme
```

### Entity Initialization Parameters

```java
// Robot creation:
health = 1200 + healthPercent * 1800 / 100;   // 1200..3000
speed = 25 + speedPercent * 10 / 100;         // 25..35
maxSpeed = 6300 + maxSpeedPercent * 700 / 100; // 6300..7000
spinAccel = 150 + spinPercent * 50 / 100;      // 150..200
maxAngVel = 80 + angVelPercent * 120 / 100;    // 80..200

// Initial state:
posX = startPosition;
posY = terrainHeight(posX) + 12800;  // 50 pixels above ground
velX = 3200;  // initial forward speed (~12.5 px/tick)
```

---

## 14. Summary for PixiJS Implementation

### What matters for Robo Drop (inverse kinematics approach):

Since Robo Drop uses **book events** (not forward simulation), only the **visual physics** matters:

1. **Trajectory** = parabolic arc from start to end point (gravity = ~800 px/s²)
2. **Rotation** = total spins from book event, use easeInOut interpolation
3. **Landing angle** = determined by `landedOn` body part
4. **Bounce effect** = visual upward kick of ~1280 velocity units ≈ 5 px/frame
5. **Limb detachment** = visual: kick limb with vel=1000, angVel=1500+random(0..1023)
6. **Camera** = 25% lerp following player, zoom based on height
7. **Air resistance** = 0.3% per tick for flung limbs (mostly cosmetic)

### Key Numbers (converted to pixels at 60fps):

| Parameter | Original (30fps, <<8) | Converted (60fps, pixels) |
|-----------|----------------------|--------------------------|
| Gravity | 82/tick | ~5.4 px/tick or **324 px/s** deceleration |
| Air drag | 3/1024 per tick | ~0.15% per tick |
| Bounce kick | 1280 velocity | ~5 px/tick upward |
| Tangential friction | 0.703 | 0.703 (dimensionless) |
| Initial vx | 3200 | ~12.5 px/tick |
| Limb kick | 1000 velocity | ~3.9 px/tick |
| Limb spin | 1500-2523 | ~5.9-9.9 angular units/tick |
| Joint spring (body) | error/60 | proportional |
| Joint spring (extremity) | error/40 | stiffer |
| Joint limit (arm) | ±150 (of 1024) | ±53° |
| Joint limit (hand) | ±210 (of 1024) | ±74° |
| Camera lerp | >>2 (25%) | 0.25 per tick |
| Spin acceleration | 150 | ~0.59 angular units/tick |
| Counter-spin | -4000 | strong brake |

### PRNG

Uses Linear Congruential Generator with multiplier **-1644122274** (= `0x9E3779B2`, related to golden ratio hash). Used for:
- Terrain generation noise
- Limb detachment random angular velocity
- Obstacle placement
