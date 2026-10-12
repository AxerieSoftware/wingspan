import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { SummaryScreen } from './models/summaryScreen';
import { CashFlowSummaryScreen } from './services/cashFlowSummaryScreen';
import { ReportsSummaryScreen } from './services/reportsSummaryScreen';

/** The pages whose row of totals Wingspan adds cards to: Cash Flow and Reports' cash flow tab. */
export function createSummaryScreens(app: WingspanBuilder, businessFilter: BusinessFilter): SummaryScreen[] {
	return [new CashFlowSummaryScreen(app.pages.cashFlow, businessFilter.view, app.calendar), new ReportsSummaryScreen(app.pages.reports, businessFilter.view)];
}
