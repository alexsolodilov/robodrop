<script lang="ts">
	import { stateGame } from '../game/stateGame.svelte';
	import type { LimbId, LimbState } from '../game/types';

	const limbOrder: { id: LimbId; label: string }[] = [
		{ id: 'left_leg', label: 'LL' },
		{ id: 'right_leg', label: 'RL' },
		{ id: 'left_arm', label: 'LA' },
		{ id: 'right_arm', label: 'RA' },
	];

	function getColor(state: LimbState): string {
		switch (state) {
			case 'intact':
				return 'var(--limb-intact)';
			case 'loosened':
				return 'var(--limb-loosened)';
			case 'detached':
				return 'var(--limb-detached)';
		}
	}
</script>

<div class="limb-indicator">
	{#each limbOrder as limb}
		{@const state = stateGame.limbs[limb.id]}
		<div
			class="limb"
			class:intact={state === 'intact'}
			class:loosened={state === 'loosened'}
			class:detached={state === 'detached'}
			style="background-color: {getColor(state)}"
		>
			{limb.label}
		</div>
	{/each}
	<div class="limb head" class:detached={stateGame.headCatapulting}>HD</div>
</div>

<style>
	.limb-indicator {
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.limb {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: bold;
		color: #000;
		transition: background-color 0.3s, transform 0.2s;
	}

	.limb.intact {
		background-color: var(--limb-intact, #4caf50);
	}

	.limb.loosened {
		background-color: var(--limb-loosened, #ffeb3b);
		animation: pulse-limb 0.5s infinite alternate;
	}

	.limb.detached {
		background-color: var(--limb-detached, #555);
		color: #888;
		opacity: 0.5;
	}

	.head {
		background-color: var(--limb-intact, #4caf50);
	}

	.head.detached {
		background-color: var(--limb-detached, #555);
		color: #888;
		opacity: 0.5;
	}

	@keyframes pulse-limb {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.1);
		}
	}
</style>
