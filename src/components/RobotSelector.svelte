<script lang="ts">
	import { stateGame } from '../game/stateGame.svelte';
	import type { RobotType } from '../game/types';
	import { config } from '../game/config';

	type Props = {
		onSelect?: (robot: RobotType) => void;
	};

	const props: Props = $props();

	function selectRobot(type: RobotType) {
		stateGame.robotType = type;
		props.onSelect?.(type);
	}
</script>

<div class="robot-selector">
	<button
		class="robot-option"
		class:selected={stateGame.robotType === 'tank'}
		onclick={() => selectRobot('tank')}
	>
		<div class="robot-icon tank-icon">
			<div class="robot-body"></div>
		</div>
		<div class="robot-name">TANK</div>
		<div class="robot-desc">Low Volatility</div>
		<div class="robot-trait">Tough &bull; Steady wins</div>
	</button>

	<button
		class="robot-option"
		class:selected={stateGame.robotType === 'acro'}
		onclick={() => selectRobot('acro')}
	>
		<div class="robot-icon acro-icon">
			<div class="robot-body"></div>
		</div>
		<div class="robot-name">ACRO</div>
		<div class="robot-desc">High Volatility</div>
		<div class="robot-trait">Agile &bull; Big potential</div>
	</button>
</div>

<style>
	.robot-selector {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.robot-option {
		background: rgba(255, 255, 255, 0.08);
		border: 2px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 16px 20px;
		cursor: pointer;
		transition: all 0.3s;
		text-align: center;
		color: #ccc;
		min-width: 120px;
	}

	.robot-option:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.robot-option.selected {
		border-color: #ffd700;
		background: rgba(255, 215, 0, 0.1);
		color: #fff;
	}

	.robot-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto 8px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tank-icon {
		background: linear-gradient(135deg, #4a6fa5, #2c4a7c);
	}

	.acro-icon {
		background: linear-gradient(135deg, #e85d75, #b83b5e);
	}

	.robot-body {
		width: 24px;
		height: 28px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 4px;
	}

	.robot-name {
		font-size: 16px;
		font-weight: bold;
		margin-bottom: 2px;
	}

	.robot-desc {
		font-size: 11px;
		color: #999;
		margin-bottom: 4px;
	}

	.robot-trait {
		font-size: 10px;
		color: #777;
	}
</style>
