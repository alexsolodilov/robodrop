import type { BetType } from 'utils-book';
import type { RobotType, LandingType, LimbId, CrashReason } from './types';

export type BookEventGameStart = {
	type: 'gameStart';
	robot: RobotType;
	slopeLength: number;
	finishX: number;
};

export type BookEventKick = {
	type: 'kick';
	force: number;
	initialVx: number;
	initialVy: number;
};

export type BookEventBounce = {
	type: 'bounce';
	index: number;
	positionX: number;
	slopeY: number;
	landedOn: LandingType;

	launchVx: number;
	launchVy: number;
	airTime: number;
	spinCount: number;

	penaltyDivisor: number;
	limbLost: LimbId | null;
	limbLoosened: LimbId | null;
	spinBonus: number;
	distanceBonus: number;

	currentMultiplier: number;

	result?: 'crash';
	crashReason?: CrashReason;
	finalMultiplier?: number;
};

export type BookEventHeadCatapult = {
	type: 'headCatapult';
	positionX: number;
	slopeY: number;
	penaltyDivisor: number;

	headLaunchVx: number;
	headLaunchVy: number;
	headAirTime: number;
	headSpinCount: number;
	headLandsAtX: number;

	finishLineX: number;
	reachedFinish: boolean;

	finalMultiplier: number;
};

export type BookEventFinalResult = {
	type: 'finalResult';
	outcome: 'win' | 'crash';
	robot: RobotType;
	distanceTraveled: number;
	totalBounces: number;
	totalSpins: number;
	limbsLost: number;
	payoutMultiplier: number;
};

export type BookEvent =
	| BookEventGameStart
	| BookEventKick
	| BookEventBounce
	| BookEventHeadCatapult
	| BookEventFinalResult;

export type Bet = BetType<BookEvent>;
export type BookEventContext = { bookEvents: BookEvent[] };
