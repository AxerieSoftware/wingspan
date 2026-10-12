import type { SummaryRowPage } from '../../../monarch/pages/summaryRow';
import type { EntityScope } from '../../businessEntities/models/entityScope';

/** Inclusive "YYYY-MM-DD" dates. */
export interface SummaryDates {
	startDate: string;
	endDate: string;
}

/** The dates and entities a page's totals cover. */
export interface SummaryView {
	dates: SummaryDates;
	scope: EntityScope;
	/** Set when the page shows the income exactly, with all its filters; otherwise loaded for the dates and entities. */
	income: number | null;
}

/** A page with a row of totals Wingspan adds cards to, and what those totals cover. */
export interface SummaryScreen {
	readonly page: SummaryRowPage;
	/** The entities the page shows. */
	currentScope(): EntityScope;
	/** Null when the page doesn't cover one stretch of dates yet, like Reports while it shows all time. */
	currentView(): SummaryView | null;
}
