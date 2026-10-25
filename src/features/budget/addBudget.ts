import type { WingspanBuilder } from '../../wingspanBuilder';
import { CategoryAveragesFeature } from './categoryAverages/categoryAveragesFeature';
import { CategoryAveragesCalculator } from './categoryAverages/services/categoryAveragesCalculator';
import { HsaSpendingFeature } from './hsaSpending/hsaSpendingFeature';

/** Adds longer averages to the History popover on Monarch's Budget page, and notes what each row paid from an HSA. */
export function addBudget(app: WingspanBuilder): void {
	const { pages, monarchApi, monarchData, dataService, syncedQueries, calendar, formatter } = app;
	app.addFeature(new CategoryAveragesFeature(pages.budget, monarchApi.budget, new CategoryAveragesCalculator(calendar), syncedQueries, formatter));
	app.addFeature(new HsaSpendingFeature(pages.budget, monarchData, dataService, monarchApi.transactions, monarchApi.budget, syncedQueries, calendar, formatter));
}
