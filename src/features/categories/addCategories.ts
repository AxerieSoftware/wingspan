import type { WingspanBuilder } from '../../wingspanBuilder';
import { MonthlyAverageFeature } from './monthlyAverage/monthlyAverageFeature';
import { MonthlyAverageCalculator } from './monthlyAverage/services/monthlyAverageCalculator';

/** Adds an average per month to the Summary on Monarch's category pages. */
export function addCategories(app: WingspanBuilder): void {
	const { pages, calendar, formatter } = app;
	app.addFeature(new MonthlyAverageFeature(pages.categorySummary, new MonthlyAverageCalculator(calendar), formatter));
}
