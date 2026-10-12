import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { Recurring } from '../recurring/createRecurring';
import type { SummaryScreen } from '../summaryScreens/models/summaryScreen';
import { AccountsInterestFeature } from './accountsInterestFeature';
import { InterestCostSummaryFeature } from './interestCostSummaryFeature';
import { LoanInterestFeature } from './loanInterestFeature';
import { InterestCostCalculator } from './services/interestCostCalculator';
import { LoanBalanceEstimator } from './services/loanBalanceEstimator';

/** Adds what debt interest costs to the totals on those pages, to Accounts' groups and to each loan's page, with balance updates for manual loans. */
export function addInterestCost(app: WingspanBuilder, screens: readonly SummaryScreen[], businessFilter: BusinessFilter, recurring: Recurring): void {
	const { window, pages, monarchData, monarchApi, queryClient, calendar, formatter } = app;
	const calculator = new InterestCostCalculator(calendar);
	for (const screen of screens) app.addFeature(new InterestCostSummaryFeature(screen, monarchData, calculator, formatter));
	app.addFeature(new AccountsInterestFeature(pages.accounts, monarchData, businessFilter.view, calculator, formatter));
	app.addFeature(new LoanInterestFeature(window, pages.accountDetails, monarchData, recurring, monarchApi.loans, queryClient, new LoanBalanceEstimator(calendar), formatter));
}
