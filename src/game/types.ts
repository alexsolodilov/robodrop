export type RobotType = 'tank' | 'acro';

export type LimbId = 'left_leg' | 'right_leg' | 'left_arm' | 'right_arm';

export type LandingType = 'both_feet' | 'one_leg' | 'arm' | 'body' | 'head';

export type LimbState = 'intact' | 'loosened' | 'detached';

export type RoundOutcome = 'win' | 'crash';

export type CrashReason = 'head_landing' | 'stuck' | 'head_missed_finish';

export type BetMode = 'tank' | 'acro';

export interface LimbStatus {
	left_leg: LimbState;
	right_leg: LimbState;
	left_arm: LimbState;
	right_arm: LimbState;
}

export interface RobotState {
	type: RobotType;
	limbs: LimbStatus;
	x: number;
	y: number;
	vx: number;
	vy: number;
	rotation: number;
	isFlying: boolean;
}
