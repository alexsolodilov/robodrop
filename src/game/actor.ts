import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';
import { stateGame, resetGameState } from './stateGame.svelte';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		// Show final result immediately without animation
		const finalResult = betToResume.state.find((e) => e.type === 'finalResult');
		if (finalResult && finalResult.type === 'finalResult') {
			stateGame.roundResult = {
				outcome: finalResult.outcome,
				payoutMultiplier: finalResult.payoutMultiplier,
				distanceTraveled: finalResult.distanceTraveled,
				totalBounces: finalResult.totalBounces,
				totalSpins: finalResult.totalSpins,
				limbsLost: finalResult.limbsLost,
			};
			stateGame.showResult = true;
		}
	},
	onNewGameStart: async () => {
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) return;
		resetGameState();
		stateBet.winBookEventAmount = 0;
	},
	onNewGameError: () => {
		resetGameState();
	},
	onPlayGame: async (bet) => await playBet(bet),
	checkIsBonusGame: () => false, // No bonus games in Robo Drop
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
