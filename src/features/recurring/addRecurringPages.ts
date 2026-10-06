import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { CashSettings } from '../cashFlow/cashSettings/addCashSettings';
import { CheckingPayingAccount } from '../cashFlow/cashSettings/services/checkingPayingAccount';
import type { ProjectedBalancesService } from '../cashFlow/projectedBalances/services/projectedBalancesService';
import type { Recurring } from './createRecurring';
import { DueDatesFeature } from './dueDates/dueDatesFeature';
import { DueDateCalculator } from './dueDates/services/dueDateCalculator';
import { RecurringItemsFeature } from './recurringItems/recurringItemsFeature';
import { RecurringLineBuilder } from './recurringItems/services/recurringLineBuilder';
import { StatementLinesReconciler } from './statements/services/statementLinesReconciler';

/** Adds Wingspan's rows and due dates to the Recurring page. */
export function addRecurringPages(app: WingspanBuilder, recurring: Recurring, cashSettings: CashSettings, projectedBalances: ProjectedBalancesService, businessFilter: BusinessFilter): void {
	const { window, calendar, formatter, dataService, monarchData, syncScheduler, syncedQueries, pages } = app;
	const { kinds, recurrence, payments, itemServices } = recurring;
	app.addFeature(
		new RecurringItemsFeature(
			window,
			pages.recurring,
			monarchData,
			dataService,
			syncScheduler,
			{
				itemRepository: recurring.itemRepository,
				ledgerService: recurring.ledgerService,
				lineBuilder: new RecurringLineBuilder(recurrence, payments, kinds),
				statementLines: new StatementLinesReconciler(calendar, kinds),
				statementsTotals: recurring.statementsTotals
			},
			new CheckingPayingAccount(dataService, cashSettings.entityCashSettings),
			projectedBalances,
			businessFilter,
			itemServices
		)
	);
	app.addFeature(
		new DueDatesFeature(pages.recurring, app.monarchApi.recurring, syncedQueries, dataService, new DueDateCalculator(calendar), itemServices.dueLabels, syncScheduler, calendar, formatter)
	);
}
