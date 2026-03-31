import { mergeMessagesMaps } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';
import en from './en';

const messagesMapGame = { en };
const messagesMap = mergeMessagesMaps([messagesMapGame, messagesMapUiHtml]);

export default messagesMap;
