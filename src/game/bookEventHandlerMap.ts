import { stateGame, resetGameState } from './stateGame.svelte';
import { getGameEngine } from './utils';
import {
	KICK_DURATION_MS,
	RESULT_DELAY_MS,
} from './constants';

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const bookEventHandlerMap = {
	gameStart: async (event: any) => {
		resetGameState();
		stateGame.robotType = event.robot;
		stateGame.slopeLength = event.slopeLength;
		stateGame.finishX = event.finishX;
		stateGame.isPlaying = true;

		const engine = getGameEngine();
		if (engine) {
			await engine.setupRound(event);
		}
	},

	kick: async (event: any) => {
		const engine = getGameEngine();
		if (engine) {
			await engine.startKick(event);
		}
	},

	bounce: async (event: any) => {
		const engine = getGameEngine();

		// Wait for the robot to reach the bounce position
		if (engine) {
			await engine.waitForBounce(event);
		}

		stateGame.currentBounceIndex = event.index;
		stateGame.robotX = event.positionX;
		stateGame.distanceTraveled = event.positionX;

		// Update multiplier
		if (event.currentMultiplier !== undefined) {
			stateGame.currentMultiplier = event.currentMultiplier;
			stateGame.displayMultiplier = event.currentMultiplier;
		}

		// Screen shake on bad landings
		if (event.landedOn === 'head') {
			engine?.triggerScreenShake(10);
		} else if (event.landedOn !== 'both_feet') {
			engine?.triggerScreenShake(6);
		}

		// Handle limb loosening (TANK only)
		if (event.limbLoosened) {
			stateGame.limbs[event.limbLoosened] = 'loosened';
		}

		// Handle limb detachment
		if (event.limbLost) {
			stateGame.limbs[event.limbLost] = 'detached';
			stateGame.limbsLost++;
			stateGame.lastLimbLost = event.limbLost;
		}

		// Landing penalty
		if (event.penaltyDivisor > 1) {
			stateGame.lastLandingPenalty = event.penaltyDivisor;
		}

		// Spin bonus (tracking only — visual notifications happen mid-flight in GameEngine)
		if (event.spinCount > 0 && event.spinBonus > 1) {
			stateGame.lastSpinBonus = event.spinBonus;
			stateGame.totalSpins += event.spinCount;
		}

		stateGame.totalBounces++;

		// Crash — play crash effects, do NOT launch
		if (event.result === 'crash') {
			if (engine) {
				await engine.playCrash(event);
			}
			stateGame.isPlaying = false;
			return;
		}

		// Finalize terrain when we reach the finish area
		if (event.positionX >= stateGame.finishX && engine) {
			engine.finalizeTerrain();
		}

		// Launch to next bounce — but NOT if we've reached/passed the finish
		if (engine && event.positionX < stateGame.finishX) {
			await engine.launchFromBounce(event);
		}
	},

	headCatapult: async (event: any) => {
		const engine = getGameEngine();

		stateGame.headCatapulting = true;
		engine?.finalizeTerrain();
		engine?.triggerSlowMotion(2000);

		if (engine) {
			await engine.playHeadCatapult(event);
		}

		stateGame.headReachedFinish = event.reachedFinish;
		stateGame.currentMultiplier = event.finalMultiplier;
		stateGame.displayMultiplier = event.finalMultiplier;
	},

	finalResult: async (event: any) => {
		stateGame.isPlaying = false;
		stateGame.roundResult = {
			outcome: event.outcome,
			payoutMultiplier: event.payoutMultiplier,
			distanceTraveled: event.distanceTraveled,
			totalBounces: event.totalBounces,
			totalSpins: event.totalSpins,
			limbsLost: event.limbsLost,
		};

		await sleep(RESULT_DELAY_MS);
		stateGame.showResult = true;
	},
};
