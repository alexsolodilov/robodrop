<script lang="ts">
	import { stateGame } from '../game/stateGame.svelte';

	const multiplierClass = $derived(
		stateGame.displayMultiplier <= 0
			? 'neutral'
			: stateGame.displayMultiplier >= 10
				? 'high'
				: 'positive',
	);
</script>

<div class="multiplier-display">
	<span class="label">MULT</span>
	<span class="value {multiplierClass}">
		{#if stateGame.displayMultiplier > 0}
			&times;{stateGame.displayMultiplier.toFixed(1)}
		{:else}
			&times;0.0
		{/if}
	</span>
</div>

<style>
	.multiplier-display {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 8px;
		backdrop-filter: blur(4px);
	}

	.label {
		font-size: 11px;
		color: #aaa;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.value {
		font-size: 22px;
		font-weight: bold;
		font-family: 'Arial', sans-serif;
		transition: color 0.3s;
	}

	.neutral {
		color: #aaa;
	}

	.positive {
		color: #4caf50;
	}

	.high {
		color: #ffd700;
		text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
	}
</style>
