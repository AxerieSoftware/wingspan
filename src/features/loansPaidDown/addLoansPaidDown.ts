import type { WingspanBuilder } from '../../wingspanBuilder';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import { LoansPaidDownFeature } from './loansPaidDownFeature';
import { LoansPaidDownCalculator } from './services/loansPaidDownCalculator';

/** Adds how much the loans went down to the totals on those pages. */
export function addLoansPaidDown(app: WingspanBuilder, screens: readonly SummaryScreen[]): void {
	const { monarchApi, queryClient, calendar, formatter } = app;
	const calculator = new LoansPaidDownCalculator();
	for (const screen of screens) app.addFeature(new LoansPaidDownFeature(screen, monarchApi.loans, monarchApi.cashFlow, calculator, queryClient, calendar, formatter));
}
