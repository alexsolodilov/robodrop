// Slope geometry
export const SLOPE_LENGTH = 1800;
export const FINISH_LINE_X = 1500;
export const SLOPE_START_Y = 100;
export const SLOPE_END_Y = 500;
export const SLOPE_ANGLE = Math.atan2(SLOPE_END_Y - SLOPE_START_Y, SLOPE_LENGTH);

// Physics
export const GRAVITY = 0.35;
export const GROUND_FRICTION = 0.98;

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
