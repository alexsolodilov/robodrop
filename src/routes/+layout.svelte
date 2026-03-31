<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import { installMockRgs } from '../game/mockRgs';
	import { setContext } from '../game/context';
	import Game from '../components/Game.svelte';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };
	const props: Props = $props();

	const params = new URLSearchParams(window.location.search);
	const hasSession = !!params.get('sessionID') || params.get('replay') === 'true';

	// In dev mode without a session, install mock RGS
	if (!hasSession) {
		installMockRgs();
	}

	setContext();
</script>

{#if hasSession}
	<GlobalStyle>
		<Authenticate>
			<LoadI18n {messagesMap}>
				<Game />
			</LoadI18n>
		</Authenticate>
	</GlobalStyle>
{:else}
	<GlobalStyle>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</GlobalStyle>
{/if}

{@render props.children()}
