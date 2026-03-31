// Slope geometry
export const SLOPE_LENGTH = 1800;
export const FINISH_LINE_X = 1500;
export const SLOPE_START_Y = 100;
export const SLOPE_END_Y = 500;
export const SLOPE_ANGLE = Math.atan2(SLOPE_END_Y - SLOPE_START_Y, SLOPE_LENGTH);

// Robot sprite dimensions (px)
export const ROBOT_BODY_WIDTH = 48;
export const ROBOT_BODY_HEIGHT = 56;

// Camera
export const CAMERA_LEAD = 0.15;
export const CAMERA_SMOOTH = 0.08;

// Timing
export const KICK_DURATION_MS = 600;
export const BOUNCE_IMPACT_DURATION_MS = 200;
export const LIMB_DETACH_DURATION_MS = 400;
export const HEAD_CATAPULT_DELAY_MS = 300;
export const RESULT_DELAY_MS = 1200;
export const SLOW_MOTION_FACTOR = 0.3;
export const SLOW_MOTION_DURATION_MS = 1500;

// Visual
export const SPARK_COUNT = 12;
export const BOLT_PARTICLE_COUNT = 8;
export const SCREEN_SHAKE_INTENSITY = 6;
export const SCREEN_SHAKE_DURATION_MS = 300;

// Layout
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// Colors
export const COLORS = {
	sky: 0x4fc3f7,
	slopeLight: 0x8d6e63,
	slopeDark: 0x5d4037,
	finishLine: 0xffeb3b,
	finishGlow: 0xffc107,
	sparkGood: 0xffd700,
	sparkBad: 0xff4444,
	boltParticle: 0xcccccc,
	multiplierGreen: 0x4caf50,
	multiplierRed: 0xf44336,
	multiplierGold: 0xffd700,
	uiBackground: 0x1a1a2e,
	uiPanel: 0x16213e,
} as const;

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
