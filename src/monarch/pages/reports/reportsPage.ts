import { gridItemRow } from '../monarchGrid';
import type { MonarchNavigator } from '../monarchNavigator';
import type { SlotContent } from '../mountedSlot';
import { type SummaryCard, type SummaryCardLook, SummaryRow, type SummaryRowPage } from '../summaryRow';
import { WingspanAttribute } from '../wingspanAttributes';

const REPORTS_CASH_FLOW_PATH = '/reports/cash-flow';
/** Reports' totals sit in the chart's grid area, above the chart card. */
const SUMMARY_AREA = 'chart';
/** Under the chart card's title: "Jan 1, 2026 – Oct 11, 2026", one date for a single day, or "All time". */
const CHART_SUBTITLE_SELECTOR = '[class*="ReportsChartCard__Subtitle"]';
const SHOWN_DATE_PATTERN = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/g;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUSINESS_FILTER_PARAM = 'businessEntitySet';
const TOTAL_INCOME_LABEL = 'Total income';

/** The dates a report covers, inclusive "YYYY-MM-DD". */
export interface ReportDates {
	startDate: string;
	endDate: string;
}

/*
 * Monarch's Reports page, Cash flow tab: /reports/cash-flow
 *
 * +- grid ------------------------------------------------------------+
 * | chart     [Total income] [Total expenses] [Net income] [Rate]     |
 * |           +- chart card: "All time" or "Jan 1, 2026 – Oct 11, 2026"
 * | transactions                                    summary           |
 * +-------------------------------------------------------------------+
 *
 * Wingspan's card goes last in the row of totals, after Savings rate.
 */
export class ReportsPage implements SummaryRowPage {
	private readonly summaryRow: SummaryRow;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {
		this.summaryRow = new SummaryRow(window.document, () => gridItemRow(window.document, SUMMARY_AREA), WingspanAttribute.reportsSummaryCard);
	}

	public get isActive(): boolean {
		return this.navigator.isUnder(REPORTS_CASH_FLOW_PATH);
	}

	/** The business ids chosen in Monarch's filter, with "business_entity_none" for Household; empty shows everything. */
	public get businessEntityFilter(): string[] {
		return new URLSearchParams(this.window.location.search).getAll(BUSINESS_FILTER_PARAM);
	}

	/** Read from the chart card, which shows Monarch's own dates for a relative range like "This year". Null for all time or while it loads. */
	public get dates(): ReportDates | null {
		const subtitle = this.window.document.querySelector(CHART_SUBTITLE_SELECTOR)?.textContent ?? '';
		const shownDates = [...subtitle.matchAll(SHOWN_DATE_PATTERN)].map(([, month, day, year]) => this.toIsoDate(month ?? '', day ?? '', year ?? ''));
		const startDate = shownDates[0];
		if (!startDate) return null;
		return { startDate, endDate: shownDates[1] ?? startDate };
	}

	/** Exactly as Monarch shows it, with every filter on the page applied. Null while it loads. */
	public get totalIncome(): number | null {
		return this.summaryRow.amountOf(TOTAL_INCOME_LABEL);
	}

	public get summaryCardLook(): SummaryCardLook | null {
		return this.summaryRow.look;
	}

	public showSummaryCard(card: SummaryCard, content: SlotContent): void {
		this.summaryRow.showCard(card, content);
	}

	public removeSummaryCard(card: SummaryCard): void {
		this.summaryRow.removeCard(card);
	}

	private toIsoDate(monthName: string, day: string, year: string): string {
		const month = MONTH_NAMES.indexOf(monthName) + 1;
		return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
	}
}
