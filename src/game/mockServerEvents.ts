/**
 * Mock book event generator for Robo Drop.
 * Direct port of Python gamestate.py simulation logic.
 *
 * Calibrated to ~95-96% RTP for both TANK and ACRO modes.
 */
import type { BookEvent } from './typesBookEvent';
import type { RobotType, LandingType, LimbId } from './types';

// ---------------------------------------------------------------------------
// Seeded RNG (Mulberry32)
// ---------------------------------------------------------------------------
class SeededRng {
	private state: number;
	constructor(seed?: number) {
		this.state = seed ?? (Math.random() * 2 ** 32) >>> 0;
	}
	random(): number {
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	uniform(min: number, max: number): number {
		return min + this.random() * (max - min);
	}
	randInt(min: number, max: number): number {
		return Math.floor(this.uniform(min, max + 1));
	}
	choice<T>(items: T[]): T {
		return items[Math.floor(this.random() * items.length)];
	}
	weightedChoice<T>(items: T[], weights: number[]): T {
		const total = weights.reduce((s, w) => s + w, 0);
		let r = this.random() * total;
		for (let i = 0; i < items.length; i++) {
			r -= weights[i];
			if (r <= 0) return items[i];
		}
		return items[items.length - 1];
	}
}

// ---------------------------------------------------------------------------
// Config (must match Python game_config.py exactly)
// ---------------------------------------------------------------------------

const ROBOT_CONFIG = {
	tank: {
		penalties: { one_leg: 1.5, arm: 2.0, body: 3.0 },
		limb_durability: 2,
		spin_ability: 0.9,
		head_crash_prob: 0.0175,
	},
	acro: {
		penalties: { one_leg: 2.0, arm: 3.0, body: 4.0 },
		limb_durability: 1,
		spin_ability: 1.0,
		head_crash_prob: 0.0597,
	},
} as const;

const LANDING_PROBS: Record<string, Record<string, number>> = {
	tank: { both_feet: 0.48, one_leg: 0.22, arm: 0.18, body: 0.0, head: 0.12 },
	acro: { both_feet: 0.60, one_leg: 0.16, arm: 0.12, body: 0.0, head: 0.12 },
};

const SPIN_BONUSES: Record<string, Record<number, number>> = {
	tank: { 0: 1.0, 1: 1.30, 2: 2.0, 3: 3.5, 4: 6.5 },
	acro: { 0: 1.0, 1: 1.38, 2: 2.3, 3: 4.0, 4: 8.0 },
};

const DISTANCE_INTERVAL = 200;
const DISTANCE_BONUS: Record<string, number> = { tank: 0.195, acro: 0.225 };
const HEAD_CATAPULT_SCALE = 25.0;
const SLOPE_LENGTH = 1800;
const FINISH_X = 1500;
const WINCAP = 1000;

// Physics constants — must match GameEngine.ts
const PHYSICS_GRAVITY = 400;  // px/s²
const PHYSICS_VEL_SCALE = 30;
// Must match Slope.ts SLOPE_DROP_RATIO (tan(45°) = 1.0)
const SLOPE_GRADIENT = 1.0;

// Per-landing-type outgoing flight parameters.
// Good landings → longer flights → more spins → bigger bonuses.
// Bad landings → short low flights → no spins.
//
// bounceDist is DERIVED: vx × VEL_SCALE × airTime (flat-ground estimate).
// The physics engine adds ~10-15% from the downhill slope on top of this.
//
// Target weighted-avg dist ≈ 180 per bounce (~8 bounces to FINISH_X 1500):
//   E[both_feet]=289 × .48 + E[one_leg]=90 × .22 + E[arm]=47 × .18 ≈ 168
const FLIGHT_PARAMS: Record<string, { airMin: number; airMax: number; vxMin: number; vxMax: number }> = {
	both_feet: { airMin: 1.0, airMax: 2.5, vxMin: 4, vxMax: 7 },
	one_leg:   { airMin: 0.5, airMax: 1.3, vxMin: 2, vxMax: 4 },
	arm:       { airMin: 0.4, airMax: 1.0, vxMin: 1.5, vxMax: 3 },
	body:      { airMin: 0.3, airMax: 0.7, vxMin: 0.5, vxMax: 2 },
	head:      { airMin: 0, airMax: 0, vxMin: 0, vxMax: 0 },
};

const LIMB_IDS: LimbId[] = ['left_leg', 'right_leg', 'left_arm', 'right_arm'];

// ---------------------------------------------------------------------------
// Limb tracking
// ---------------------------------------------------------------------------
class LimbState {
	private state: Record<LimbId, number> = {
		left_leg: 0, right_leg: 0, left_arm: 0, right_arm: 0,
	};
	get(id: LimbId): number { return this.state[id]; }
	hit(id: LimbId): void { this.state[id] = Math.min(2, this.state[id] + 1); }
	detach(id: LimbId): void { this.state[id] = 2; }
	isDetached(id: LimbId): boolean { return this.state[id] === 2; }
	isLoosened(id: LimbId): boolean { return this.state[id] === 1; }
	activeLegs(): LimbId[] { return (['left_leg', 'right_leg'] as LimbId[]).filter(id => !this.isDetached(id)); }
	activeArms(): LimbId[] { return (['left_arm', 'right_arm'] as LimbId[]).filter(id => !this.isDetached(id)); }
	activeLimbs(): LimbId[] { return LIMB_IDS.filter(id => !this.isDetached(id)); }
	allDetached(): boolean { return LIMB_IDS.every(id => this.isDetached(id)); }
	detachedCount(): number { return LIMB_IDS.filter(id => this.isDetached(id)).length; }
}

// ---------------------------------------------------------------------------
// Landing probability adjustment
// ---------------------------------------------------------------------------
function getLandingProbs(limbs: LimbState, robotKey: string, headCrashProb: number): Record<string, number> {
	if (limbs.allDetached()) {
		return { both_feet: 0, one_leg: 0, arm: 0, body: 1 - headCrashProb, head: headCrashProb };
	}

	const probs = { ...LANDING_PROBS[robotKey] };
	probs.head = headCrashProb;
	probs.body = 0;

	const nLegs = limbs.activeLegs().length;
	const nArms = limbs.activeArms().length;

	if (nLegs === 0) { probs.both_feet = 0; probs.one_leg = 0; }
	else if (nLegs === 1) { probs.both_feet = 0; }

	if (nArms === 0) { probs.arm = 0; }

	const total = Object.values(probs).reduce((s, v) => s + v, 0);
	if (total <= 0) return { both_feet: 0, one_leg: 0, arm: 0, body: 0, head: 1 };

	for (const k of Object.keys(probs)) probs[k] /= total;
	return probs;
}

function pickLanding(probs: Record<string, number>, rng: SeededRng): LandingType {
	let r = rng.random();
	for (const [landing, prob] of Object.entries(probs)) {
		r -= prob;
		if (r <= 0) return landing as LandingType;
	}
	return 'head';
}

function pickSpinCount(airTime: number, spinAbility: number, rng: SeededRng): number {
	const maxPossible = Math.min(4, Math.floor(airTime * 1.45 * spinAbility));
	if (maxPossible <= 0) return 0;

	const weights = [5, 3, 1.0, 0.25].slice(0, maxPossible + 1);
	const choices = Array.from({ length: maxPossible + 1 }, (_, i) => i);
	return rng.weightedChoice(choices, weights);
}

function slopeYAtX(x: number): number {
	// Match Slope.ts: y = x * tan(45°) ≈ x * 1.0
	return x * SLOPE_GRADIENT;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
export function generateMockRoboDropEvents(robotType: RobotType = 'tank', seed?: number): BookEvent[] {
	const rng = new SeededRng(seed);
	const robotKey = robotType;
	const cfg = ROBOT_CONFIG[robotKey];
	const spinBonusTable = SPIN_BONUSES[robotKey];
	const distBonusValue = DISTANCE_BONUS[robotKey];

	const events: BookEvent[] = [];
	const limbs = new LimbState();

	// gameStart
	events.push({ type: 'gameStart', robot: robotKey, slopeLength: SLOPE_LENGTH, finishX: FINISH_X });

	// kick
	const kickVx = rng.uniform(3.0, 6.0);
	const kickVy = rng.uniform(-9.0, -3.0);
	events.push({ type: 'kick', force: Math.round(rng.uniform(6, 10) * 100) / 100, initialVx: Math.round(kickVx * 100) / 100, initialVy: Math.round(kickVy * 100) / 100 });

	let multiplier = 1.0;
	let positionX = 0;
	let totalBounces = 0;
	let totalSpins = 0;
	let limbsLost = 0;
	let crashed = false;
	let crashReason: string | undefined;
	let reachedFinish = false;
	let bounceIdx = 0;
	let prevDistIntervals = 0;

	while (positionX < FINISH_X && !crashed) {
		bounceIdx++;

		// --- 1. Landing type --------------------------------------------------
		const landingProbs = getLandingProbs(limbs, robotKey, cfg.head_crash_prob);
		const landedOn = pickLanding(landingProbs, rng);

		// --- 2. Flight params (for outgoing arc after this bounce) ------------
		// All derived from landing quality so math ↔ visuals stay consistent.
		const fp = FLIGHT_PARAMS[landedOn] ?? FLIGHT_PARAMS.body;
		const airTime = rng.uniform(fp.airMin, fp.airMax);
		const launchVx = rng.uniform(fp.vxMin, fp.vxMax);

		// Derive launch velocity from airTime, accounting for the downhill slope.
		// Parabola y(t) = vy·t + ½g·t² meets slope y = m·vx·t when:
		//   t_land = 2·(m·vx - vy) / g
		// We want t_land = airTime, so: vy = m·vx - airTime·g/2
		const vx = launchVx * PHYSICS_VEL_SCALE;
		const launchVy = (SLOPE_GRADIENT * vx - airTime * PHYSICS_GRAVITY / 2) / PHYSICS_VEL_SCALE;

		// bounceDist = horizontal distance on the slope (exact match to physics)
		const bounceDist = Math.max(40, vx * airTime);

		positionX += bounceDist;
		const slopeY = slopeYAtX(positionX);

		// --- 3. Distance bonus ------------------------------------------------
		const curDistIntervals = Math.floor(positionX / DISTANCE_INTERVAL);
		const newIntervals = curDistIntervals - prevDistIntervals;
		const incrementalDistBonus = newIntervals * distBonusValue;
		if (incrementalDistBonus > 0) multiplier += incrementalDistBonus;
		prevDistIntervals = curDistIntervals;

		// --- 4. Spins (derived from airTime) ----------------------------------
		const spinCount = pickSpinCount(airTime, cfg.spin_ability, rng);
		const spinBonusValue = spinBonusTable[Math.min(spinCount, 4)] ?? 1.0;
		totalSpins += spinCount;
		if (spinBonusValue > 1.0) multiplier *= spinBonusValue;

		// --- 5. Landing penalties ---------------------------------------------
		let penaltyDivisor = 1;
		let limbLost: LimbId | null = null;
		let limbLoosened: LimbId | null = null;
		let isCrash = false;

		if (landedOn === 'head') {
			isCrash = true;
			crashReason = 'head_landing';
			multiplier = 0;
		} else if (landedOn === 'one_leg') {
			penaltyDivisor = cfg.penalties.one_leg;
			multiplier /= penaltyDivisor;
			const legs = limbs.activeLegs();
			if (legs.length > 0) {
				const target = legs.includes('right_leg') ? 'right_leg' : legs[0];
				if (cfg.limb_durability === 2 && !limbs.isLoosened(target)) {
					limbs.hit(target);
					limbLoosened = target;
				} else {
					limbs.detach(target);
					limbLost = target;
					limbsLost++;
				}
			}
		} else if (landedOn === 'arm') {
			penaltyDivisor = cfg.penalties.arm;
			multiplier /= penaltyDivisor;
			const arms = limbs.activeArms();
			if (arms.length > 0) {
				const target = arms.includes('right_arm') ? 'right_arm' : arms[0];
				if (cfg.limb_durability === 2 && !limbs.isLoosened(target)) {
					limbs.hit(target);
					limbLoosened = target;
				} else {
					limbs.detach(target);
					limbLost = target;
					limbsLost++;
				}
			}
		} else if (landedOn === 'body') {
			penaltyDivisor = cfg.penalties.body;
			multiplier /= penaltyDivisor;
		}

		multiplier = Math.max(0, Math.min(multiplier, WINCAP));
		multiplier = Math.round(multiplier * 100) / 100;

		// Robot too damaged to continue — multiplier crushed below minimum
		if (!isCrash && multiplier > 0 && multiplier < 0.2) {
			isCrash = true;
			crashReason = 'too_damaged';
			multiplier = 0;
		}

		totalBounces++;
		const spinBonusDisplay = spinBonusValue;

		if (isCrash) {
			events.push({
				type: 'bounce', index: bounceIdx, positionX: Math.round(positionX),
				slopeY: Math.round(slopeY), landedOn: landedOn as LandingType,
				launchVx: 0, launchVy: 0, airTime: 0, spinCount: 0,
				penaltyDivisor, limbLost, limbLoosened,
				spinBonus: spinBonusDisplay, distanceBonus: incrementalDistBonus,
				currentMultiplier: 0, result: 'crash', crashReason: crashReason as any, finalMultiplier: 0,
			});
			crashed = true;
			break;
		}

		events.push({
			type: 'bounce', index: bounceIdx, positionX: Math.round(positionX),
			slopeY: Math.round(slopeY), landedOn: landedOn as LandingType,
			launchVx: Math.round(launchVx * 100) / 100,
			launchVy: Math.round(launchVy * 100) / 100,
			airTime: Math.round(airTime * 100) / 100, spinCount,
			penaltyDivisor, limbLost, limbLoosened,
			spinBonus: spinBonusDisplay, distanceBonus: Math.round(incrementalDistBonus * 100) / 100,
			currentMultiplier: multiplier,
		});

		// Body landing → head catapult
		if (landedOn === 'body') {
			const headVx = rng.uniform(8, 14);
			const headVy = rng.uniform(-8, -5);
			const headAirTime = rng.uniform(1.5, 3.0);
			const headSpinCount = rng.randInt(3, 6);
			const headTravel = headVx * headAirTime * HEAD_CATAPULT_SCALE;
			const headLandsAt = positionX + headTravel;
			const headReached = headLandsAt >= FINISH_X;

			if (!headReached) {
				multiplier = 0;
				crashReason = 'head_missed_finish';
			}

			events.push({
				type: 'headCatapult',
				positionX: Math.round(positionX), slopeY: Math.round(slopeY),
				penaltyDivisor,
				headLaunchVx: Math.round(headVx * 100) / 100,
				headLaunchVy: Math.round(headVy * 100) / 100,
				headAirTime: Math.round(headAirTime * 100) / 100,
				headSpinCount, headLandsAtX: Math.round(headLandsAt),
				finishLineX: FINISH_X, reachedFinish: headReached,
				finalMultiplier: headReached ? multiplier : 0,
			});

			if (headReached) reachedFinish = true;
			else crashed = true;
			break;
		}
	}

	if (positionX >= FINISH_X && !crashed && !reachedFinish) {
		reachedFinish = true;
	}

	const outcome = reachedFinish && multiplier > 0 ? 'win' : 'crash';
	const finalPayout = outcome === 'win' ? multiplier : 0;

	events.push({
		type: 'finalResult', outcome, robot: robotKey,
		distanceTraveled: Math.round(Math.min(positionX, SLOPE_LENGTH)),
		totalBounces, totalSpins, limbsLost,
		payoutMultiplier: Math.round(finalPayout * 100),
	});

	return events;
}
