import type { WingspanBuilder } from '../../wingspanBuilder';
import { LoanBalanceEstimator } from './services/loanBalanceEstimator';
import { ManualLoanUpdates } from './services/manualLoanUpdates';

/** The manual loans' entered balances, linked payments and estimates, shared by the interest and loans paid down features. */
export function createManualLoans(app: WingspanBuilder): ManualLoanUpdates {
	const { window, monarchApi, dataService, queryClient, calendar, formatter } = app;
	return app.addShared(new ManualLoanUpdates(window, dataService, monarchApi.loans, queryClient, new LoanBalanceEstimator(calendar), formatter));
}
