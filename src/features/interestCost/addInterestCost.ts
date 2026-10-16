import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import { AccountsInterestFeature } from './accountsInterestFeature';
import { InterestCostSummaryFeature } from './interestCostSummaryFeature';
import { LoanInterestFeature } from './loanInterestFeature';
import { LoanPaymentLinksFeature } from './loanPaymentLinksFeature';
import { LoanPaymentPromptsFeature } from './loanPaymentPromptsFeature';
import { InterestCostCalculator } from './services/interestCostCalculator';
import { LoanBalanceEstimator } from './services/loanBalanceEstimator';
import { ManualLoanUpdates } from './services/manualLoanUpdates';

/** Adds what debt interest costs to the totals on those pages, to Accounts' groups and to each loan's page, with balance updates for manual loans and reminders once a linked payment posts. */
export function addInterestCost(app: WingspanBuilder, screens: readonly SummaryScreen[], businessFilter: BusinessFilter): void {
	const { window, pages, monarchData, monarchApi, dataService, syncScheduler, queryClient, calendar, formatter } = app;
	const calculator = new InterestCostCalculator(calendar);
	const manualLoans = app.addShared(new ManualLoanUpdates(window, dataService, monarchApi.loans, queryClient, new LoanBalanceEstimator(calendar), formatter));
	for (const screen of screens) app.addFeature(new InterestCostSummaryFeature(screen, monarchData, calculator, formatter));
	app.addFeature(new AccountsInterestFeature(pages.accounts, monarchData, businessFilter.view, calculator, formatter));
	app.addFeature(new LoanInterestFeature(pages.accountDetails, monarchData, manualLoans, formatter));
	app.addFeature(new LoanPaymentLinksFeature(pages.recurring, monarchData, manualLoans, syncScheduler));
	app.addFeature(new LoanPaymentPromptsFeature(pages.transactionDrawer, pages.accounts, pages.sidebar, monarchData, manualLoans, syncScheduler, formatter));
}
