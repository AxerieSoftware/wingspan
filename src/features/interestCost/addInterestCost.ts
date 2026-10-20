import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import { AccountsInterestFeature } from './accountsInterestFeature';
import { InterestCostSummaryFeature } from './interestCostSummaryFeature';
import { LoanInterestFeature } from './loanInterestFeature';
import { LoanPaymentLinksFeature } from './loanPaymentLinksFeature';
import { LoanPaymentPromptsFeature } from './loanPaymentPromptsFeature';
import { InterestCostCalculator } from './services/interestCostCalculator';
import type { ManualLoanUpdates } from './services/manualLoanUpdates';

/** Adds what debt interest costs to the totals on those pages, to Accounts' groups and to each loan's page, with balance updates for manual loans and reminders once a linked payment posts. */
export function addInterestCost(app: WingspanBuilder, screens: readonly SummaryScreen[], businessFilter: BusinessFilter, manualLoans: ManualLoanUpdates): void {
	const { pages, monarchData, syncScheduler, calendar, formatter } = app;
	const calculator = new InterestCostCalculator(calendar);
	for (const screen of screens) app.addFeature(new InterestCostSummaryFeature(screen, monarchData, calculator, calendar, formatter));
	app.addFeature(new AccountsInterestFeature(pages.accounts, monarchData, businessFilter.view, calculator, formatter));
	app.addFeature(new LoanInterestFeature(pages.accountDetails, monarchData, manualLoans, formatter));
	app.addFeature(new LoanPaymentLinksFeature(pages.recurring, monarchData, manualLoans, syncScheduler));
	app.addFeature(new LoanPaymentPromptsFeature(pages.transactionDrawer, pages.accounts, pages.sidebar, monarchData, manualLoans, syncScheduler, formatter));
}
