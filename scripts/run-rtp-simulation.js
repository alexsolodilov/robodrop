/**
 * RTP Monte Carlo Simulation for Robo Drop
 * Exact copy of mockServerEvents.ts logic (no imports, standalone).
 *
 * Run:  node scripts/run-rtp-simulation.js
 * Auto-tune:  node scripts/run-rtp-simulation.js --tune
 */

// ---------------------------------------------------------------------------
// Seeded RNG (Mulberry32) — identical to mockServerEvents.ts
// ---------------------------------------------------------------------------
class SeededRng {
	constructor(seed) { this.state = seed ?? (Math.random() * 2 ** 32) >>> 0; }
	random() {
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	uniform(min, max) { return min + this.random() * (max - min); }
	randInt(min, max) { return Math.floor(this.uniform(min, max + 1)); }
	weightedChoice(items, weights) {
		const total = weights.reduce((s, w) => s + w, 0);
		let r = this.random() * total;
		for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
		return items[items.length - 1];
	}
}

// ---------------------------------------------------------------------------
// Game config — MUST mirror mockServerEvents.ts exactly
// ---------------------------------------------------------------------------
const ROBOT_CONFIG = {
	tank: {
		penalties: { one_leg: 1.5, arm: 2.0, body: 3.0 },
		limb_durability: 2,
		spin_ability: 0.9,
		head_crash_prob: 0.0217,
	},
	acro: {
		penalties: { one_leg: 2.0, arm: 3.0, body: 4.0 },
		limb_durability: 1,
		spin_ability: 1.0,
		head_crash_prob: 0.0633,
	},
};

const LANDING_PROBS = {
	tank: { both_feet: 0.48, one_leg: 0.22, arm: 0.18, body: 0.0, head: 0.12 },
	acro: { both_feet: 0.60, one_leg: 0.16, arm: 0.12, body: 0.0, head: 0.12 },
};

const SPIN_BONUSES = {
	tank: { 0: 1.0, 1: 1.30, 2: 2.0, 3: 3.5, 4: 6.5 },
	acro: { 0: 1.0, 1: 1.38, 2: 2.3, 3: 4.0, 4: 8.0 },
};

const DISTANCE_INTERVAL = 200;
const DISTANCE_BONUS = { tank: 0.195, acro: 0.225 };
const HEAD_CATAPULT_SCALE = 25.0;
const SLOPE_LENGTH = 1800;
const FINISH_X = 1500;
const WINCAP = 1000;
const PHYSICS_GRAVITY = 400;
const PHYSICS_VEL_SCALE = 30;

const FLIGHT_PARAMS = {
	both_feet: { airMin: 1.0, airMax: 2.5, vxMin: 4, vxMax: 7 },
	one_leg:   { airMin: 0.5, airMax: 1.3, vxMin: 2, vxMax: 4 },
	arm:       { airMin: 0.4, airMax: 1.0, vxMin: 1.5, vxMax: 3 },
	body:      { airMin: 0.3, airMax: 0.7, vxMin: 0.5, vxMax: 2 },
	head:      { airMin: 0, airMax: 0, vxMin: 0, vxMax: 0 },
};

const LIMB_IDS = ['left_leg', 'right_leg', 'left_arm', 'right_arm'];

// ---------------------------------------------------------------------------
// Helpers — identical to mockServerEvents.ts
// ---------------------------------------------------------------------------
function slopeYAtX(x) {
	const t = Math.max(0, Math.min(1, x / SLOPE_LENGTH));
	return 100 + t * 400;
}

function getLandingProbs(limbState, robotKey, headCrashProb) {
	if (LIMB_IDS.every(id => limbState[id] >= 2)) {
		return { both_feet: 0, one_leg: 0, arm: 0, body: 1 - headCrashProb, head: headCrashProb };
	}
	const probs = { ...LANDING_PROBS[robotKey] };
	probs.head = headCrashProb;
	probs.body = 0;
	const nLegs = ['left_leg', 'right_leg'].filter(id => limbState[id] < 2).length;
	const nArms = ['left_arm', 'right_arm'].filter(id => limbState[id] < 2).length;
	if (nLegs === 0) { probs.both_feet = 0; probs.one_leg = 0; }
	else if (nLegs === 1) { probs.both_feet = 0; }
	if (nArms === 0) { probs.arm = 0; }
	const total = Object.values(probs).reduce((s, v) => s + v, 0);
	if (total <= 0) return { both_feet: 0, one_leg: 0, arm: 0, body: 0, head: 1 };
	for (const k of Object.keys(probs)) probs[k] /= total;
	return probs;
}

function pickLanding(probs, rng) {
	let r = rng.random();
	for (const [landing, prob] of Object.entries(probs)) {
		r -= prob;
		if (r <= 0) return landing;
	}
	return 'head';
}

const DEFAULT_SPIN_WEIGHTS = [5, 3, 1.0, 0.25];

function pickSpinCount(airTime, spinAbility, rng, spinWeights = DEFAULT_SPIN_WEIGHTS) {
	const maxPossible = Math.min(4, Math.floor(airTime * 1.45 * spinAbility));
	if (maxPossible <= 0) return 0;
	const weights = spinWeights.slice(0, maxPossible + 1);
	const choices = Array.from({ length: maxPossible + 1 }, (_, i) => i);
	return rng.weightedChoice(choices, weights);
}

// ---------------------------------------------------------------------------
// Single-round simulation — returns payout multiplier (0 = crash)
// ---------------------------------------------------------------------------
function simulateRound(robotType, rng, overrides = {}) {
	const cfg = { ...ROBOT_CONFIG[robotType] };
	if (overrides.head_crash_prob !== undefined) cfg.head_crash_prob = overrides.head_crash_prob;
	if (overrides.spin_ability !== undefined) cfg.spin_ability = overrides.spin_ability;

	const spinBonusTable = overrides.spin_bonuses ?? SPIN_BONUSES[robotType];
	const spinWeights = overrides.spin_weights ?? DEFAULT_SPIN_WEIGHTS;
	const distBonusValue = overrides.distance_bonus ?? DISTANCE_BONUS[robotType];
	const flightParams = overrides.flight_params ?? FLIGHT_PARAMS;

	const limbState = { left_leg: 0, right_leg: 0, left_arm: 0, right_arm: 0 };
	const limbDurability = cfg.limb_durability;

	let multiplier = 1.0;
	let positionX = 0;
	let prevDistIntervals = 0;
	let crashed = false;

	// consume kick RNG draws (3 calls)
	rng.uniform(3, 6); rng.uniform(-9, -3); rng.uniform(6, 10);

	while (positionX < FINISH_X && !crashed) {
		// 1. Landing type
		const landingProbs = getLandingProbs(limbState, robotType, cfg.head_crash_prob);
		const landedOn = pickLanding(landingProbs, rng);

		// 2. Flight params
		const fp = flightParams[landedOn] ?? flightParams.body;
		const airTime = rng.uniform(fp.airMin, fp.airMax);
		const launchVx = rng.uniform(fp.vxMin, fp.vxMax);
		const bounceDist = Math.max(40, launchVx * PHYSICS_VEL_SCALE * airTime);
		positionX += bounceDist;

		// 3. Distance bonus
		const curDistIntervals = Math.floor(positionX / DISTANCE_INTERVAL);
		const newIntervals = curDistIntervals - prevDistIntervals;
		if (newIntervals > 0) multiplier += newIntervals * distBonusValue;
		prevDistIntervals = curDistIntervals;

		// 4. Spins
		const spinCount = pickSpinCount(airTime, cfg.spin_ability, rng, spinWeights);
		const spinBonusValue = spinBonusTable[Math.min(spinCount, 4)] ?? 1.0;
		if (spinBonusValue > 1.0) multiplier *= spinBonusValue;

		// 5. Landing penalties
		if (landedOn === 'head') {
			multiplier = 0;
			crashed = true;
		} else if (landedOn === 'one_leg') {
			multiplier /= cfg.penalties.one_leg;
			const legs = ['left_leg', 'right_leg'].filter(id => limbState[id] < 2);
			if (legs.length > 0) {
				const t = legs.includes('right_leg') ? 'right_leg' : legs[0];
				if (limbDurability === 2 && limbState[t] < 1) limbState[t] = 1;
				else limbState[t] = 2;
			}
		} else if (landedOn === 'arm') {
			multiplier /= cfg.penalties.arm;
			const arms = ['left_arm', 'right_arm'].filter(id => limbState[id] < 2);
			if (arms.length > 0) {
				const t = arms.includes('right_arm') ? 'right_arm' : arms[0];
				if (limbDurability === 2 && limbState[t] < 1) limbState[t] = 1;
				else limbState[t] = 2;
			}
		} else if (landedOn === 'body') {
			multiplier /= cfg.penalties.body;
			// head catapult
			const headVx = rng.uniform(8, 14);
			rng.uniform(-8, -5); // headVy (consumed)
			const headAirTime = rng.uniform(1.5, 3.0);
			rng.randInt(3, 6); // headSpinCount (consumed)
			const headTravel = headVx * headAirTime * HEAD_CATAPULT_SCALE;
			const headLandsAt = positionX + headTravel;
			if (headLandsAt < FINISH_X) {
				multiplier = 0;
				crashed = true;
			}
			break;
		}

		multiplier = Math.max(0, Math.min(multiplier, WINCAP));
		multiplier = Math.round(multiplier * 100) / 100;
	}

	if (crashed || multiplier <= 0) return 0;
	return Math.min(multiplier, WINCAP);
}

// ---------------------------------------------------------------------------
// Run simulation for one robot type
// ---------------------------------------------------------------------------
function runSim(robotType, rounds = 500000, overrides = {}) {
	let totalPayout = 0;
	let maxWin = 0;
	let wins = 0;
	let totalBounces = 0;
	const buckets = { '0x': 0, '0-1x': 0, '1-2x': 0, '2-5x': 0, '5-10x': 0, '10-50x': 0, '50-100x': 0, '100+': 0 };

	for (let i = 0; i < rounds; i++) {
		const rng = new SeededRng(i * 31337 + 42);
		const payout = simulateRound(robotType, rng, overrides);
		totalPayout += payout;
		if (payout > maxWin) maxWin = payout;
		if (payout > 0) wins++;

		if (payout === 0) buckets['0x']++;
		else if (payout < 1) buckets['0-1x']++;
		else if (payout < 2) buckets['1-2x']++;
		else if (payout < 5) buckets['2-5x']++;
		else if (payout < 10) buckets['5-10x']++;
		else if (payout < 50) buckets['10-50x']++;
		else if (payout < 100) buckets['50-100x']++;
		else buckets['100+']++;
	}

	const rtp = (totalPayout / rounds) * 100;
	return { rtp, maxWin, winRate: (wins / rounds) * 100, avgWin: wins > 0 ? totalPayout / wins : 0, buckets, rounds };
}

function printResult(label, r) {
	console.log(`\n${'═'.repeat(60)}`);
	console.log(`  ${label} (${r.rounds.toLocaleString()} rounds)`);
	console.log('═'.repeat(60));
	console.log(`  RTP:       ${r.rtp.toFixed(2)}%`);
	console.log(`  Max Win:   ${r.maxWin.toFixed(2)}x`);
	console.log(`  Win Rate:  ${r.winRate.toFixed(1)}%`);
	console.log(`  Avg Win:   ${r.avgWin.toFixed(2)}x (when winning)`);
	console.log('─'.repeat(60));
	for (const [bucket, count] of Object.entries(r.buckets)) {
		const pct = (count / r.rounds * 100).toFixed(2);
		const bar = '█'.repeat(Math.round(count / r.rounds * 60));
		console.log(`  ${bucket.padEnd(8)} ${String(count).padStart(7)} (${pct.padStart(6)}%) ${bar}`);
	}
}

// ---------------------------------------------------------------------------
// Binary search helper: find head_crash_prob that gives targetRtp
// ---------------------------------------------------------------------------
function findCrashProb(robotType, targetRtp, rounds, extraOverrides = {}) {
	let lo = 0.005, hi = 0.25;
	let best = { prob: 0.05, result: null };
	for (let iter = 0; iter < 18; iter++) {
		const mid = (lo + hi) / 2;
		const r = runSim(robotType, rounds, { head_crash_prob: mid, ...extraOverrides });
		const diff = r.rtp - targetRtp;
		if (diff > 0) lo = mid; else hi = mid;
		best = { prob: mid, result: r };
		if (Math.abs(diff) < 0.3) break;
	}
	return best;
}

// ---------------------------------------------------------------------------
// Auto-tune: grid search over multiple knobs × binary search crash_prob
// ---------------------------------------------------------------------------
function autoTune(robotType, targetRtp = 96.0, rounds = 200000, maxCrashPct = 70) {
	const minWinPct = 100 - maxCrashPct;
	console.log(`\nAuto-tuning ${robotType.toUpperCase()} → RTP ~${targetRtp}%, win ≥ ${minWinPct}%, crash ≤ ${maxCrashPct}%...`);

	const spinAbilities = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
	const airMaxValues = [2.5, 3.0, 3.5, 4.0];
	const spinWeightPresets = {
		'default':   [5, 3, 1.0, 0.25],
		'medium':    [4, 3, 1.5, 0.5],
		'aggressive':[3, 2.5, 2.0, 1.0],
	};
	const quadBonusValues = {
		tank: [6.5, 10, 15],
		acro: [8.0, 12, 18, 25],
	};

	let bestCombo = null;

	for (const sa of spinAbilities) {
		for (const airMax of airMaxValues) {
			for (const [swName, sw] of Object.entries(spinWeightPresets)) {
				for (const qb of quadBonusValues[robotType]) {
					const fp = { ...FLIGHT_PARAMS, both_feet: { ...FLIGHT_PARAMS.both_feet, airMax } };
					const sb = { ...SPIN_BONUSES[robotType], 4: qb };
					const overrides = { spin_ability: sa, flight_params: fp, spin_bonuses: sb, spin_weights: sw };

					const { prob, result } = findCrashProb(robotType, targetRtp, rounds, overrides);
					if (!result || Math.abs(result.rtp - targetRtp) > 1.0) continue;

					// Enforce crash rate constraint
					const crashPct = 100 - result.winRate;
					if (crashPct > maxCrashPct) continue;

					const score = result.maxWin;
					const label = `sa=${sa} air=${airMax} sw=${swName} qb=${qb} crash=${prob.toFixed(4)} → RTP=${result.rtp.toFixed(1)}% win=${result.winRate.toFixed(0)}% max=${result.maxWin.toFixed(0)}x`;

					if (!bestCombo || score > bestCombo.score) {
						bestCombo = { sa, airMax, sw, swName, qb, prob, result, score, label, sb };
					}

					console.log(`  ${label}${score === bestCombo?.score ? ' ★' : ''}`);
				}
			}
		}
	}

	if (!bestCombo) {
		console.log('  ✗ No valid parameters within constraints!');
		return {};
	}

	console.log(`\n  ✓ Best: ${bestCombo.label}`);
	return {
		head_crash_prob: bestCombo.prob,
		spin_ability: bestCombo.sa,
		airMax: bestCombo.airMax,
		spin_weights: bestCombo.sw,
		spin_weights_name: bestCombo.swName,
		quad_bonus: bestCombo.qb,
		spin_bonuses: bestCombo.sb,
		result: bestCombo.result,
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const tuneMode = args.includes('--tune');
const ROUNDS = 500000;

if (tuneMode) {
	console.log('\n🤖 ROBO DROP — AUTO-TUNE MODE\n');
	console.log('Grid search: spin_ability × airMax × head_crash_prob\n');
	const tankResult = autoTune('tank', 96.0, 200000, 50);  // crash ≤ 50%
	const acroResult = autoTune('acro', 96.0, 200000, 70);  // crash ≤ 70%

	console.log('\n' + '═'.repeat(60));
	console.log('  FINAL TUNED PARAMETERS');
	console.log('═'.repeat(60));
	for (const [name, r] of [['TANK', tankResult], ['ACRO', acroResult]]) {
		console.log(`\n  ${name}:`);
		if (r.head_crash_prob) console.log(`    head_crash_prob: ${r.head_crash_prob.toFixed(4)}`);
		if (r.spin_ability) console.log(`    spin_ability: ${r.spin_ability}`);
		if (r.airMax) console.log(`    FLIGHT_PARAMS.both_feet.airMax: ${r.airMax}`);
		if (r.spin_weights_name) console.log(`    spin_weights: [${r.spin_weights}] (${r.spin_weights_name})`);
		if (r.quad_bonus) console.log(`    spin_bonus[4]: ${r.quad_bonus}`);
		if (r.spin_bonuses) console.log(`    spin_bonuses: ${JSON.stringify(r.spin_bonuses)}`);
		if (r.result) console.log(`    → RTP: ${r.result.rtp.toFixed(2)}%, maxWin: ${r.result.maxWin.toFixed(1)}x`);
	}

	// Verify with larger sample
	console.log('\n  Verifying with 1M rounds...');
	function makeOverrides(r) {
		const o = {};
		if (r.head_crash_prob) o.head_crash_prob = r.head_crash_prob;
		if (r.spin_ability) o.spin_ability = r.spin_ability;
		if (r.airMax) o.flight_params = { ...FLIGHT_PARAMS, both_feet: { ...FLIGHT_PARAMS.both_feet, airMax: r.airMax } };
		if (r.spin_weights) o.spin_weights = r.spin_weights;
		if (r.spin_bonuses) o.spin_bonuses = r.spin_bonuses;
		return o;
	}
	const vTank = runSim('tank', 1000000, makeOverrides(tankResult));
	const vAcro = runSim('acro', 1000000, makeOverrides(acroResult));
	printResult('TANK (verified 1M)', vTank);
	printResult('ACRO (verified 1M)', vAcro);
} else {
	console.log('\n🤖 ROBO DROP — RTP SIMULATION\n');
	console.log(`Running ${ROUNDS.toLocaleString()} rounds per robot...\n`);

	const tank = runSim('tank', ROUNDS);
	const acro = runSim('acro', ROUNDS);

	printResult('TANK', tank);
	printResult('ACRO', acro);

	const spread = Math.abs(tank.rtp - acro.rtp);
	console.log(`\n${'═'.repeat(60)}`);
	console.log(`  TANK-ACRO spread: ${spread.toFixed(2)}%`);
	console.log(`  Target: RTP ~96%, spread < 0.5%, maxWin up to 1000x`);
	console.log('═'.repeat(60));
}
