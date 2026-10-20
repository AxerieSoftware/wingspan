import type { WingspanBuilder } from '../../wingspanBuilder';
import { LoanBalanceEstimator } from '../interestCost/services/loanBalanceEstimator';
import type { ManualLoanUpdates } from '../interestCost/services/manualLoanUpdates';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import { LoansPaidDownFeature } from './loansPaidDownFeature';
import { LoansPaidDownCalculator } from './services/loansPaidDownCalculator';

/** Adds how much the loans went down to the totals on those pages. */
export function addLoansPaidDown(app: WingspanBuilder, screens: readonly SummaryScreen[], manualLoans: ManualLoanUpdates): void {
	const { monarchApi, monarchData, queryClient, calendar, formatter } = app;
	const calculator = new LoansPaidDownCalculator(new LoanBalanceEstimator(calendar));
	for (const screen of screens) app.addFeature(new LoansPaidDownFeature(screen, monarchData, manualLoans, monarchApi.loans, monarchApi.cashFlow, calculator, queryClient, calendar, formatter));
}
