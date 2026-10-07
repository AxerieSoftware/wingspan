import { AccountsPage } from './accounts/accountsPage';
import { CashFlowPage } from './cashFlow/cashFlowPage';
import { PageHeader } from './header/pageHeader';
import { MonarchNavigator } from './monarchNavigator';
import { RecurringV2Page } from './recurringV2/recurringV2Page';
import { SettingsPage } from './settings/settingsPage';
import { SidebarPage } from './sidebar/sidebarPage';
import { ReceiptsPage } from './transactions/receiptsPage';

export interface MonarchPages {
	accounts: AccountsPage;
	cashFlow: CashFlowPage;
	header: PageHeader;
	receipts: ReceiptsPage;
	recurring: RecurringV2Page;
	settings: SettingsPage;
	sidebar: SidebarPage;
}

export function createMonarchPages(window: Window): MonarchPages {
	const navigator = new MonarchNavigator(window);
	return {
		accounts: new AccountsPage(window, navigator),
		cashFlow: new CashFlowPage(window, navigator),
		header: new PageHeader(window.document, navigator),
		receipts: new ReceiptsPage(window.document, navigator),
		recurring: new RecurringV2Page(window),
		settings: new SettingsPage(window, navigator),
		sidebar: new SidebarPage(window.document)
	};
}
