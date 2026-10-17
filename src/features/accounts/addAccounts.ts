import type { WingspanBuilder } from '../../wingspanBuilder';
import { AccountSyncFeature } from './accountSync/accountSyncFeature';
import { HsaReimbursementsFeature } from './hsaReimbursements/hsaReimbursementsFeature';

/** Adds to Monarch's account pages what's left to reimburse from an HSA, and to Transactions when the accounts last synced. */
export function addAccounts(app: WingspanBuilder): void {
	const { window, pages, monarchData, dataService, syncedQueries, queryClient, toastService, syncScheduler, formatter } = app;
	app.addFeature(new HsaReimbursementsFeature(window, pages.accountDetails, monarchData, dataService, app.monarchApi.transactions, syncedQueries, queryClient, formatter));
	app.addFeature(new AccountSyncFeature(window, pages.header, pages.accounts, app.monarchApi.accounts, syncedQueries, queryClient, toastService, syncScheduler, formatter));
}
