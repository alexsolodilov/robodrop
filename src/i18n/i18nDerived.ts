import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';
import { stateI18nDerived } from 'state-shared';

export const i18nDerived = {
	...i18nDerivedUiHtml,
	launch: () => stateI18nDerived.translate('LAUNCH'),
	auto: () => stateI18nDerived.translate('AUTO'),
	turbo: () => stateI18nDerived.translate('TURBO'),
	gameInfo: () => stateI18nDerived.translate('GAME_INFO'),
	win: () => stateI18nDerived.translate('WIN'),
	crashed: () => stateI18nDerived.translate('CRASHED'),
};
