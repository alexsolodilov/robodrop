import type { RobotType, LimbStatus, LimbState, RoundOutcome } from './types';

const createInitialLimbs = (): LimbStatus => ({
	left_leg: 'intact',
	right_leg: 'intact',
	left_arm: 'intact',
	right_arm: 'intact',
});

export const stateGame = $state({
	// Round state
	isPlaying: false,
	isPaused: false,
	speed: 1 as 1 | 2 | 0,

	// Robot
	robotType: 'tank' as RobotType,
	limbs: createInitialLimbs(),
	robotX: 0,
	robotY: 0,
	robotRotation: 0,
	isFlying: false,

	// Multiplier
	currentMultiplier: 0,
	displayMultiplier: 0,

	// Stats
	distanceTraveled: 0,
	totalBounces: 0,
	totalSpins: 0,
	limbsLost: 0,
	currentBounceIndex: 0,

	// Slope
	slopeLength: 1800,
	finishX: 1500,

	// Result
	roundResult: null as {
		outcome: RoundOutcome;
		payoutMultiplier: number;
		distanceTraveled: number;
		totalBounces: number;
		totalSpins: number;
		limbsLost: number;
	} | null,

	// Head catapult
	headCatapulting: false,
	headX: 0,
	headY: 0,
	headReachedFinish: false,

	// UI
	showResult: false,
	lastSpinBonus: 0,
	lastLandingPenalty: 0,
	lastLimbLost: null as string | null,
});

export function resetGameState() {
	stateGame.isPlaying = false;
	stateGame.isPaused = false;
	stateGame.speed = 1;
	stateGame.robotType = stateGame.robotType; // preserve selection
	stateGame.limbs = createInitialLimbs();
	stateGame.robotX = 0;
	stateGame.robotY = 0;
	stateGame.robotRotation = 0;
	stateGame.isFlying = false;
	stateGame.currentMultiplier = 0;
	stateGame.displayMultiplier = 0;
	stateGame.distanceTraveled = 0;
	stateGame.totalBounces = 0;
	stateGame.totalSpins = 0;
	stateGame.limbsLost = 0;
	stateGame.currentBounceIndex = 0;
	stateGame.roundResult = null;
	stateGame.headCatapulting = false;
	stateGame.headX = 0;
	stateGame.headY = 0;
	stateGame.headReachedFinish = false;
	stateGame.showResult = false;
	stateGame.lastSpinBonus = 0;
	stateGame.lastLandingPenalty = 0;
	stateGame.lastLimbLost = null;
}

export function getLimbCount(state: 'intact' | 'loosened' | 'detached'): number {
	return Object.values(stateGame.limbs).filter((s) => s === state).length;
}

export function getActiveLimbCount(): number {
	return Object.values(stateGame.limbs).filter((s) => s !== 'detached').length;
}

export const stateGameDerived = {
	resetGameState,
	getLimbCount,
	getActiveLimbCount,
};
