/**
 * Mock RGS for local development without a real server.
 * Intercepts fetch calls to RGS endpoints and returns mock data.
 */
import { stateBet, stateConfig } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { generateMockRoboDropEvents } from './mockServerEvents';
import { stateGame } from './stateGame.svelte';

const MOCK_BALANCE = 10000 * API_AMOUNT_MULTIPLIER; // $10,000
const MOCK_BET_LEVELS = [
	100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000,
	50_000_000, 100_000_000,
];

let mockBalance = MOCK_BALANCE;

function createPlayResponse() {
	const betAmount = stateBet.betAmount * API_AMOUNT_MULTIPLIER;
	mockBalance -= betAmount;

	const events = generateMockRoboDropEvents(stateGame.robotType);
	const finalResult = events.find((e) => e.type === 'finalResult');
	const payoutMultiplier =
		finalResult && 'payoutMultiplier' in finalResult ? finalResult.payoutMultiplier : 0;
	// payoutMultiplier is in 100-units (e.g. 250 = 2.5x)
	const payout = payoutMultiplier > 0 ? (betAmount * payoutMultiplier) / 100 : 0;

	if (payout > 0) {
		mockBalance += payout;
	}

	return {
		balance: { amount: mockBalance, currency: stateBet.currency },
		round: {
			roundID: Math.floor(Math.random() * 1_000_000),
			amount: betAmount,
			payout,
			payoutMultiplier,
			active: true,
			mode: stateGame.robotType.toUpperCase(),
			event: null,
			state: events,
		},
	};
}

function createEndRoundResponse() {
	return {
		balance: { amount: mockBalance, currency: stateBet.currency },
	};
}

const originalFetch = window.fetch;

/**
 * Install mock RGS fetch interceptor and set up initial state.
 * Call this once when no sessionID is available.
 */
export function installMockRgs() {
	stateBet.balanceAmount = MOCK_BALANCE / API_AMOUNT_MULTIPLIER;
	stateBet.currency = 'USD';
	stateBet.betAmount = 1;
	stateConfig.betAmountOptions = MOCK_BET_LEVELS.map((l) => l / API_AMOUNT_MULTIPLIER);
	stateConfig.betMenuOptions = stateConfig.betAmountOptions;

	window.fetch = async function mockFetch(input: RequestInfo | URL, init?: RequestInit) {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		console.log('[MockRGS] fetch intercepted:', url);

		if (url.includes('/wallet/play')) {
			await new Promise((r) => setTimeout(r, 100));
			return new Response(JSON.stringify(createPlayResponse()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (url.includes('/wallet/end-round')) {
			await new Promise((r) => setTimeout(r, 50));
			return new Response(JSON.stringify(createEndRoundResponse()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (url.includes('/wallet/authenticate')) {
			return new Response(
				JSON.stringify({
					balance: { amount: mockBalance, currency: 'USD' },
					config: {
						betLevels: MOCK_BET_LEVELS,
						defaultBetLevel: 1_000_000,
						betModes: {},
						jurisdiction: {
							socialCasino: false,
							disabledFullscreen: false,
							disabledTurbo: false,
							disabledSuperTurbo: false,
							disabledAutoplay: false,
							disabledSlamstop: false,
							disabledSpacebar: false,
							disabledBuyFeature: false,
							displayNetPosition: false,
							displayRTP: false,
							displaySessionTimer: false,
							minimumRoundDuration: 0,
						},
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		}

		return originalFetch.call(window, input, init);
	} as typeof fetch;
}
