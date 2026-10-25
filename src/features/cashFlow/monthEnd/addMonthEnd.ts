import type { WingspanBuilder } from '../../../wingspanBuilder';
import type { ProjectedBalancesService } from '../projectedBalances/services/projectedBalancesService';
import { MonthEndFeature } from './monthEndFeature';
import { MonthEndCalculator } from './services/monthEndCalculator';

/** Adds where this month is headed to Cash Flow's bar chart. */
export function addMonthEnd(app: WingspanBuilder, projectedBalances: ProjectedBalancesService): void {
	const { pages, calendar, formatter } = app;
	app.addFeature(new MonthEndFeature(pages.cashFlow, projectedBalances, new MonthEndCalculator(calendar), calendar, formatter));
}
