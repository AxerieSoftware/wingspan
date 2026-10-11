import type { WingspanBuilder } from '../../wingspanBuilder';
import { HsaReimbursementsFeature } from './hsaReimbursements/hsaReimbursementsFeature';

/** Adds to Monarch's account pages: what's left to reimburse from an HSA. */
export function addAccounts(app: WingspanBuilder): void {
	const { window, pages, monarchData, dataService, syncedQueries, queryClient, formatter } = app;
	app.addFeature(new HsaReimbursementsFeature(window, pages.accountDetails, monarchData, dataService, app.monarchApi.transactions, syncedQueries, queryClient, formatter));
}
