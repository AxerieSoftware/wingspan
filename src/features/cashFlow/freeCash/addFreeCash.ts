import type { WingspanBuilder } from '../../../wingspanBuilder';
import type { Recurring } from '../../recurring/createRecurring';
import type { CashSettings } from '../cashSettings/addCashSettings';
import type { ProjectedBalancesService } from '../projectedBalances/services/projectedBalancesService';
import { FreeCashFeature } from './freeCashFeature';

/** Adds the Statements line and free cash today to Recurring's month summary. */
export function addFreeCash(app: WingspanBuilder, recurring: Recurring, cashSettings: CashSettings, projectedBalances: ProjectedBalancesService): void {
	const { pages, calendar, formatter } = app;
	app.addFeature(new FreeCashFeature(pages.recurring, pages.cashFlow, projectedBalances, recurring.statementsTotals, cashSettings.launcher, calendar, formatter));
}
