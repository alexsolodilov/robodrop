import { createEventEmitter } from 'utils-event-emitter';
import type { EmitterEventHotKey, EmitterEventUi, EmitterEventModal } from 'utils-event-emitter';
import type { LimbId, LandingType } from './types';

export type EmitterEventGame =
	| { type: 'kick'; force: number }
	| { type: 'bounce'; index: number; landedOn: LandingType; positionX: number }
	| { type: 'limbDetached'; limbId: LimbId }
	| { type: 'limbLoosened'; limbId: LimbId }
	| { type: 'spinBonus'; spinCount: number; bonus: number }
	| { type: 'landingPenalty'; divisor: number; landedOn: LandingType }
	| { type: 'headCatapult'; reachedFinish: boolean }
	| { type: 'multiplierUpdate'; value: number }
	| { type: 'distanceUpdate'; distance: number }
	| { type: 'roundEnd'; outcome: 'win' | 'crash'; multiplier: number }
	| { type: 'screenShake'; intensity: number }
	| { type: 'slowMotion'; duration: number }
	| { type: 'soundOnce'; name: string; forcePlay?: boolean }
	| { type: 'soundLoop'; name: string }
	| { type: 'soundStop'; name: string }
	| { type: 'musicStart'; name: string }
	| { type: 'musicStop' };

export type EmitterEvent =
	| EmitterEventHotKey
	| EmitterEventUi
	| EmitterEventModal
	| EmitterEventGame;

export const { eventEmitter } = createEventEmitter<EmitterEvent>();
