<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { GameEngine } from '../game/engine/GameEngine';
	import { setGameEngine } from '../game/utils';
	import { stateGame } from '../game/stateGame.svelte';
	import { eventEmitter } from '../game/eventEmitter';
	import { stateXstateDerived } from '../game/stateXstate';

	import EnableGameActor from './EnableGameActor.svelte';
	import LimbIndicator from './LimbIndicator.svelte';
	import MultiplierDisplay from './MultiplierDisplay.svelte';
	import RobotSelector from './RobotSelector.svelte';
	import RoundResult from './RoundResult.svelte';
	import GameRules from './GameRules.svelte';

	import './app.css';

	let canvasEl: HTMLCanvasElement;
	let engine: GameEngine | null = null;
	let showRules = $state(false);
	let soundMuted = $state(false);
	let showAutoConfirm = $state(false);

	const isIdle = $derived(!stateGame.isPlaying && !stateGame.showResult);
	const canLaunch = $derived(
		!stateGame.isPlaying &&
		stateBet.betAmount > 0,
	);

	onMount(() => {
		engine = new GameEngine();
		engine.init(canvasEl);
		setGameEngine(engine);

		// Handle resize
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (engine && width > 0 && height > 0) {
					engine.resize(width, height);
				}
			}
		});
		resizeObserver.observe(canvasEl.parentElement!);

		// Spacebar = launch
		const handleKey = (e: KeyboardEvent) => {
			if (e.code === 'Space') {
				e.preventDefault();
				if (canLaunch) {
					handleLaunch();
				}
			}
		};
		window.addEventListener('keydown', handleKey);

		return () => {
			window.removeEventListener('keydown', handleKey);
			resizeObserver.disconnect();
			if (engine) {
				engine.destroy();
				setGameEngine(null);
			}
		};
	});

	function handleLaunch() {
		if (!canLaunch) return;
		stateGame.showResult = false;
		if (engine) engine.reset();
		eventEmitter.broadcast({ type: 'bet' });
	}

	function handleAutoPlay() {
		showAutoConfirm = true;
	}

	function confirmAutoPlay() {
		showAutoConfirm = false;
		eventEmitter.broadcast({ type: 'autoBet' });
	}

	function cancelAutoPlay() {
		showAutoConfirm = false;
	}

	function toggleMute() {
		soundMuted = !soundMuted;
		eventEmitter.broadcast({
			type: soundMuted ? 'soundStop' : 'soundOnce',
			name: 'sfx_bounce_good',
		});
	}

	function adjustBet(direction: number) {
		const levels = stateBet.betLevels;
		if (!levels || levels.length === 0) return;
		const currentIndex = levels.indexOf(stateBet.betAmount);
		const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + direction));
		stateBet.betAmount = levels[newIndex];
	}
</script>

<div class="game-wrapper">
	<EnableGameActor />

	<!-- PixiJS Canvas -->
	<div class="game-canvas-container">
		<canvas bind:this={canvasEl}></canvas>
	</div>

	<!-- UI Overlay -->
	<div class="ui-overlay">
		<!-- Top bar: multiplier + limb indicator -->
		<div class="top-bar">
			<MultiplierDisplay />

			<div class="stats-row">
				<LimbIndicator />
				<div class="stat-badge">
					<span class="label">Dist</span>
					<span class="value">{stateGame.distanceTraveled}m</span>
				</div>
				<div class="stat-badge">
					<span class="label">Spins</span>
					<span class="value">{stateGame.totalSpins}</span>
				</div>
			</div>

			<div class="controls">
				<button class="btn btn-icon" onclick={toggleMute} title="Toggle sound">
					{soundMuted ? '🔇' : '🔊'}
				</button>
				<button class="btn btn-icon" onclick={() => (showRules = true)} title="Game Info">
					ℹ
				</button>
			</div>
		</div>

		<!-- Robot selector (idle only) -->
		{#if isIdle}
			<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
				<RobotSelector />
			</div>
		{/if}

		<!-- Bottom bar: bet controls + launch -->
		<div class="bottom-bar">
			<div class="controls">
				<button
					class="btn btn-icon"
					onclick={() => adjustBet(-1)}
					disabled={stateGame.isPlaying}
				>−</button>
				<div class="stat-badge">
					<span class="value">
						{numberToCurrencyString(stateBet.betAmount, stateBet.currency)}
					</span>
				</div>
				<button
					class="btn btn-icon"
					onclick={() => adjustBet(1)}
					disabled={stateGame.isPlaying}
				>+</button>
			</div>

			<div class="controls">
				<button
					class="btn btn-launch"
					onclick={handleLaunch}
					disabled={!canLaunch}
				>
					LAUNCH
				</button>
			</div>

			<div class="controls">
				<button
					class="btn"
					onclick={handleAutoPlay}
					disabled={stateGame.isPlaying}
				>
					AUTO
				</button>
				<button
					class="btn"
					onclick={() => { stateGame.speed = stateGame.speed === 2 ? 1 : 2; }}
					class:active={stateGame.speed === 2}
				>
					TURBO
				</button>
			</div>
		</div>

		<!-- Balance -->
		<div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);">
			<div class="stat-badge">
				<span class="label">Balance</span>
				<span class="value">
					{numberToCurrencyString(stateBet.balance, stateBet.currency)}
				</span>
			</div>
		</div>
	</div>

	<!-- Result overlay -->
	<RoundResult />

	<!-- Rules panel -->
	<GameRules visible={showRules} onClose={() => (showRules = false)} />

	<!-- Auto-play confirmation -->
	{#if showAutoConfirm}
		<div class="rules-overlay">
			<div style="background: var(--bg-panel); border-radius: 12px; padding: 24px; text-align: center; border: 1px solid var(--border-light);">
				<p style="margin: 0 0 16px; font-size: 14px;">Start auto play?</p>
				<div style="display: flex; gap: 12px; justify-content: center;">
					<button class="btn" onclick={cancelAutoPlay}>Cancel</button>
					<button class="btn btn-launch" onclick={confirmAutoPlay}>Confirm</button>
				</div>
			</div>
		</div>
	{/if}
</div>
