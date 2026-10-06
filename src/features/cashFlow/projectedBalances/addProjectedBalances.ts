import type { WingspanBuilder } from '../../../wingspanBuilder';
import type { BusinessFilter } from '../../businessEntities/models/businessFilter';
import type { Recurring } from '../../recurring/createRecurring';
import type { CashSettings } from '../cashSettings/addCashSettings';
import { FreeCashSplitter } from '../freeCash/services/freeCashSplitter';
import { ProjectedBalancesFeature } from './projectedBalancesFeature';
import { BalanceProjector } from './services/balanceProjector';
import { CardForecaster } from './services/cardForecaster';
import { CardPaymentPlanner } from './services/cardPaymentPlanner';
import { MinimumPaymentEstimator } from './services/minimumPaymentEstimator';
import { ProjectedBalancesPlanner } from './services/projectedBalancesPlanner';
import { ProjectedBalancesService } from './services/projectedBalancesService';
import { ScheduledFlowBuilder } from './services/scheduledFlowBuilder';
import { SpendingPaceCalculator } from './services/spendingPaceCalculator';

/** Adds projected checking balances to Cash Flow. Recurring's free cash and card payment notes also read this projection. */
export function addProjectedBalances(app: WingspanBuilder, recurring: Recurring, cashSettings: CashSettings, businessFilter: BusinessFilter): ProjectedBalancesService {
	const { calendar, formatter, dataService, monarchData } = app;
	const { recurrence, payments } = recurring;
	const balanceProjector = new BalanceProjector(calendar, new MinimumPaymentEstimator());
	const planner = new ProjectedBalancesPlanner(
		calendar,
		new SpendingPaceCalculator(calendar),
		new ScheduledFlowBuilder(calendar, recurrence, payments, recurring.manualBills),
		new CardForecaster(calendar, recurrence, recurring.cardPayments),
		new CardPaymentPlanner(balanceProjector),
		balanceProjector
	);
	const projectedBalances = new ProjectedBalancesService(monarchData, recurring.itemRepository, recurring.ledgerService, dataService, planner, cashSettings.entityCashSettings, businessFilter);
	app.addFeature(
		new ProjectedBalancesFeature(
			app.pages.cashFlow,
			monarchData,
			dataService,
			projectedBalances,
			app.monarchApi.budget,
			app.queryClient,
			cashSettings.launcher,
			new FreeCashSplitter(calendar),
			calendar,
			formatter
		)
	);
	return projectedBalances;
}
