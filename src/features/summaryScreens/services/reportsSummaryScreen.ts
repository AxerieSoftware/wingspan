import type { ReportsPage } from '../../../monarch/pages/reports/reportsPage';
import { EntityScope } from '../../businessEntities/models/entityScope';
import type { BusinessEntityView } from '../../businessEntities/services/businessEntityView';
import type { SummaryScreen, SummaryView } from '../models/summaryScreen';

/** Reports' date range and business filter, with the total income it shows, which already has every other filter applied. */
export class ReportsSummaryScreen implements SummaryScreen {
	public constructor(
		public readonly page: ReportsPage,
		private readonly businessView: BusinessEntityView
	) {}

	public currentScope(): EntityScope {
		const filter = this.page.businessEntityFilter;
		const businesses = this.businessView.businesses.peek();
		return businesses ? EntityScope.fromFilter(filter, businesses) : EntityScope.assumed(filter);
	}

	public currentView(): SummaryView | null {
		const dates = this.page.dates;
		const income = this.page.totalIncome;
		if (!dates || income === null) return null;
		return { dates, scope: this.currentScope(), income };
	}
}
