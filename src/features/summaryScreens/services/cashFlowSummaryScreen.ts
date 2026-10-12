import type { Calendar } from '../../../common/calendar';
import type { CashFlowPage } from '../../../monarch/pages/cashFlow/cashFlowPage';
import type { EntityScope } from '../../businessEntities/models/entityScope';
import type { BusinessEntityView } from '../../businessEntities/services/businessEntityView';
import { CashFlowPeriod } from '../models/cashFlowPeriod';
import type { SummaryScreen, SummaryView } from '../models/summaryScreen';

/** Cash Flow's month, quarter or year, for the entities its filter shows. Its income is rounded to the dollar on the page, so it's loaded. */
export class CashFlowSummaryScreen implements SummaryScreen {
	public constructor(
		public readonly page: CashFlowPage,
		private readonly businessView: BusinessEntityView,
		private readonly calendar: Calendar
	) {}

	public currentScope(): EntityScope {
		return this.businessView.scope.peek();
	}

	public currentView(): SummaryView {
		return { dates: CashFlowPeriod.of(this.page.timeframe, this.page.periodStart, this.calendar), scope: this.currentScope(), income: null };
	}
}
