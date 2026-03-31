<script lang="ts">
	import { config } from '../game/config';

	type Props = {
		visible: boolean;
		onClose: () => void;
		isSocial?: boolean;
	};

	const props: Props = $props();
</script>

{#if props.visible}
	<div class="rules-overlay" role="dialog" aria-label="Game Info">
		<div class="rules-panel">
			<button class="close-btn" onclick={props.onClose}>&times;</button>

			<h2>GAME INFO</h2>

			<section>
				<h3>HOW TO PLAY</h3>
				<p>Choose your robot (TANK or ACRO) and launch it down the slope. The robot bounces, flips, and tumbles. Flips earn multiplier bonuses. Bad landings cost limbs and divide your multiplier.</p>
				<p>Reach the finish line for a win! Land on the head at any time for a crash.</p>
			</section>

			<section>
				<h3>ROBOTS</h3>
				<table>
					<thead>
						<tr><th></th><th>TANK</th><th>ACRO</th></tr>
					</thead>
					<tbody>
						<tr><td>Volatility</td><td>Low</td><td>High</td></tr>
						<tr><td>Leg penalty</td><td>&divide;1.5</td><td>&divide;2</td></tr>
						<tr><td>Arm penalty</td><td>&divide;2</td><td>&divide;3</td></tr>
						<tr><td>Body penalty</td><td>&divide;3</td><td>&divide;4</td></tr>
						<tr><td>Limb durability</td><td>2 hits</td><td>1 hit</td></tr>
					</tbody>
				</table>
			</section>

			<section>
				<h3>LANDINGS</h3>
				<table>
					<thead>
						<tr><th>Landing</th><th>Result</th></tr>
					</thead>
					<tbody>
						<tr><td>Both feet</td><td>No penalty, good bounce</td></tr>
						<tr><td>One leg</td><td>Leg lost, weak bounce</td></tr>
						<tr><td>Arm</td><td>Arm lost, very weak bounce</td></tr>
						<tr><td>Body</td><td>Head catapults (only when all limbs lost)</td></tr>
						<tr><td>Head</td><td>Crash &mdash; 0x (any time)</td></tr>
					</tbody>
				</table>
			</section>

			<section>
				<h3>GAME STATISTICS</h3>
				<p>RTP: {(config.rtp * 100).toFixed(2)}%</p>
				<p>Max Win: {config.maxWin}x</p>
			</section>

			<section class="disclaimer">
				<h3>DISCLAIMER</h3>
				<p>
					Malfunction voids all wins and plays. A consistent internet connection is required.
					In the event of a disconnection, reload the game to finish any uncompleted rounds.
					The expected return is calculated over many plays. The game display is not representative
					of any physical device and is for illustrative purposes only. Winnings are settled according
					to the amount received from the Remote Game Server and not from events within the web browser.
				</p>
				<p>If refreshed or disconnected during a round, the round is settled immediately and the result appears in game history.</p>
				<p class="tm">TM and &copy; 2026 Stake Engine</p>
			</section>
		</div>
	</div>
{/if}

<style>
	.rules-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.rules-panel {
		background: #1a1a2e;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 24px;
		max-width: 500px;
		max-height: 80vh;
		overflow-y: auto;
		overflow-x: hidden;
		color: #ccc;
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 16px;
		background: none;
		border: none;
		color: #888;
		font-size: 24px;
		cursor: pointer;
	}

	.close-btn:hover {
		color: #fff;
	}

	h2 {
		color: #ffd700;
		font-size: 20px;
		margin: 0 0 16px;
		text-align: center;
	}

	h3 {
		color: #4fc3f7;
		font-size: 13px;
		margin: 16px 0 8px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	p {
		font-size: 12px;
		line-height: 1.5;
		margin: 4px 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
		margin: 4px 0;
	}

	th {
		text-align: left;
		padding: 4px 8px;
		color: #aaa;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	td {
		padding: 4px 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.disclaimer {
		margin-top: 20px;
		padding-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.disclaimer p {
		font-size: 10px;
		color: #888;
	}

	.tm {
		text-align: center;
		margin-top: 8px;
	}

	@media (max-height: 350px) {
		.rules-panel {
			padding: 12px;
			max-height: 95vh;
		}

		h2 {
			font-size: 16px;
			margin-bottom: 8px;
		}

		h3 {
			font-size: 11px;
			margin: 8px 0 4px;
		}

		p, td, th {
			font-size: 10px;
		}
	}
</style>
