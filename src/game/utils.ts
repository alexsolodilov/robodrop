import { createPlayBookUtils } from 'utils-book';
import { stateBet } from 'state-shared';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { resetGameState } from './stateGame.svelte';
import type { GameEngine } from './engine/GameEngine';

let _engine: GameEngine | null = null;

export function setGameEngine(engine: GameEngine | null) {
	_engine = engine;
}

export function getGameEngine(): GameEngine | null {
	return _engine;
}

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	resetGameState();

	if (_engine) {
		_engine.reset();
	}

	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
};

export const convertTorResumableBet = (bet: Bet): Bet => {
	// For resume, find the last meaningful event and replay from there
	const events = bet.state;
	const finalResultIndex = events.findIndex((e) => e.type === 'finalResult');

	if (finalResultIndex >= 0) {
		// Round already completed, just show result
		return {
			...bet,
			state: [events[0], events[finalResultIndex]],
		};
	}

	return bet;
};
