<script lang="ts">
	import { stateGame } from '../game/stateGame.svelte';
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	const result = $derived(stateGame.roundResult);
	const isWin = $derived(result?.outcome === 'win');
	// payoutMultiplier is stored as integer (×100), e.g. 256 = 2.56x
	const displayMultiplier = $derived(result ? result.payoutMultiplier / 100 : 0);
	const winAmount = $derived(
		result && isWin
			? displayMultiplier * (stateBet.betAmount / 1_000_000)
			: 0,
	);
</script>

{#if stateGame.showResult && result}
	<div class="result-overlay" class:win={isWin} class:crash={!isWin}>
		<div class="result-card">
			<div class="result-title">
				{#if isWin}
					WIN!
				{:else}
					CRASHED!
				{/if}
			</div>

			<div class="result-multiplier">
				{#if isWin}
					&times;{displayMultiplier.toFixed(2)}
				{:else}
					0x
				{/if}
			</div>

			{#if isWin && winAmount > 0}
				<div class="result-amount">
					{numberToCurrencyString(winAmount * 1_000_000, stateBet.currency)}
				</div>
			{/if}

			<div class="result-stats">
				<div class="stat">
					<span class="stat-label">Distance</span>
					<span class="stat-value">{result.distanceTraveled}m</span>
				</div>
				<div class="stat">
					<span class="stat-label">Bounces</span>
					<span class="stat-value">{result.totalBounces}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Spins</span>
					<span class="stat-value">{result.totalSpins}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Limbs lost</span>
					<span class="stat-value">{result.limbsLost}/4</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.result-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		animation: fadeIn 0.3s ease-out;
		pointer-events: none;
	}

	.win {
		background: radial-gradient(ellipse, rgba(76, 175, 80, 0.3), transparent 70%);
	}

	.crash {
		background: radial-gradient(ellipse, rgba(244, 67, 54, 0.3), transparent 70%);
	}

	.result-card {
		background: rgba(0, 0, 0, 0.85);
		border-radius: 16px;
		padding: 24px 36px;
		text-align: center;
		backdrop-filter: blur(8px);
		pointer-events: auto;
	}

	.win .result-card {
		border: 2px solid rgba(76, 175, 80, 0.5);
	}

	.crash .result-card {
		border: 2px solid rgba(244, 67, 54, 0.5);
	}

	.result-title {
		font-size: 28px;
		font-weight: bold;
		margin-bottom: 8px;
	}

	.win .result-title {
		color: #4caf50;
	}

	.crash .result-title {
		color: #f44336;
	}

	.result-multiplier {
		font-size: 42px;
		font-weight: bold;
		margin-bottom: 8px;
	}

	.win .result-multiplier {
		color: #ffd700;
		text-shadow: 0 0 16px rgba(255, 215, 0, 0.5);
	}

	.crash .result-multiplier {
		color: #ff6b6b;
	}

	.result-amount {
		font-size: 20px;
		color: #4caf50;
		margin-bottom: 16px;
	}

	.result-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 12px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-label {
		font-size: 10px;
		color: #888;
		text-transform: uppercase;
	}

	.stat-value {
		font-size: 16px;
		color: #ddd;
		font-weight: bold;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
