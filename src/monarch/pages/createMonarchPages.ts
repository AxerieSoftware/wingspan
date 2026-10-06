import { CashFlowPage } from './cashFlow/cashFlowPage';
import { MonarchNavigator } from './monarchNavigator';
import { RecurringV2Page } from './recurringV2/recurringV2Page';
import { SettingsPage } from './settings/settingsPage';
import { ReceiptsPage } from './transactions/receiptsPage';

export interface MonarchPages {
	cashFlow: CashFlowPage;
	receipts: ReceiptsPage;
	recurring: RecurringV2Page;
	settings: SettingsPage;
}

export function createMonarchPages(window: Window): MonarchPages {
	const navigator = new MonarchNavigator(window);
	return {
		cashFlow: new CashFlowPage(window, navigator),
		receipts: new ReceiptsPage(window.document, navigator),
		recurring: new RecurringV2Page(window),
		settings: new SettingsPage(window, navigator)
	};
}
