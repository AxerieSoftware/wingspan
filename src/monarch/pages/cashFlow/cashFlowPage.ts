import { ISO_DATE_PATTERN } from '../../../common/calendar';
import { gridItem, gridItemRow } from '../monarchGrid';
import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { type SummaryCard, type SummaryCardLook, SummaryRow, type SummaryRowPage } from '../summaryRow';
import { WingspanAttribute } from '../wingspanAttributes';
import { CashFlowChart } from './cashFlowChart';

const CASH_FLOW_PATH = '/cash-flow';
const GOALS_PATH = '/goals';
/** The grid area holding the chart, which both the bar and Sankey views have. */
const CHART_AREA = 'chart';
/** The grid area with the row of totals under the date: Income, Expenses, Total savings and Savings rate. */
const SUMMARY_AREA = 'summary';
const TIMEFRAMES = ['month', 'quarter', 'year'] as const;
/** Monarch keeps its Cash Flow filters in the URL as you change them, one parameter per chosen business. */
const BUSINESS_FILTER_PARAM = 'businessEntitySet';
/** The first day of the month, quarter or year shown, absent until a period other than the current one is picked. */
const DATE_PARAM = 'date';

export type CashFlowTimeframe = (typeof TIMEFRAMES)[number];

/*
 * Monarch's Cash Flow page: /cash-flow, as a bar chart or a Sankey diagram
 *
 * +- grid ------------------------------------------------+
 * | chart     bars by month                               |
 * |           +- Wingspan's section -------------------+  |
 * |           | [ render(sectionEl) mounts here ]      |  |
 * |           +----------------------------------------+  |
 * | date      "September 2026"            View [Bar chart] |
 * | summary   [Income] [Expenses] [Total savings] [Rate]  |
 * | ...       breakdown cards, or the Sankey card         |
 * +-------------------------------------------------------+
 *
 * Wingspan's section goes in the chart's grid cell, which both views have,
 * above the date and View menu that only apply to Monarch's cards. Its own
 * summary card goes last in the summary row, after Savings rate.
 */
export class CashFlowPage implements SummaryRowPage {
	/** Monarch's bar chart in the chart's cell. */
	public readonly chart: CashFlowChart;
	private readonly summaryRow: SummaryRow;
	private section: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {
		this.summaryRow = new SummaryRow(window.document, () => gridItemRow(window.document, SUMMARY_AREA), WingspanAttribute.cashFlowSummaryCard);
		this.chart = new CashFlowChart(window.document, () => gridItem(window.document, CHART_AREA));
	}

	public get isActive(): boolean {
		return this.navigator.isUnder(CASH_FLOW_PATH);
	}

	/** The timeframe in the URL, defaulting to month when it's missing or unknown. */
	public get timeframe(): CashFlowTimeframe {
		const timeframe = new URLSearchParams(this.window.location.search).get('timeframe');
		return TIMEFRAMES.find(candidate => candidate === timeframe) ?? 'month';
	}

	/**
	 * The business ids chosen in Monarch's filter, with "business_entity_none" for Household; empty shows everything.
	 * Read from the URL, since Monarch's session storage copy lags behind it.
	 */
	public get businessEntityFilter(): string[] {
		return new URLSearchParams(this.window.location.search).getAll(BUSINESS_FILTER_PARAM);
	}

	/** The first day of the period shown, or null for the current one. */
	public get periodStart(): string | null {
		const date = new URLSearchParams(this.window.location.search).get(DATE_PARAM);
		return date && ISO_DATE_PATTERN.test(date) ? date : null;
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

	public open(): void {
		this.navigator.navigateTo(CASH_FLOW_PATH);
	}

	public openGoals(): void {
		this.navigator.navigateTo(GOALS_PATH);
	}

	/** Puts Wingspan's section last in the chart's cell, or removes it while the cell isn't there. */
	public showSection(content: SlotContent): void {
		const chartGridItemEl = gridItem(this.window.document, CHART_AREA);
		if (!chartGridItemEl) {
			this.removeSection();
			return;
		}

		this.section ??= MountedSlot.mount(this.window.document, content, WingspanAttribute.cashFlowSection, { style: 'margin-top: var(--space-gutter);' });
		if (this.section.hostEl !== chartGridItemEl.lastElementChild) chartGridItemEl.append(this.section.hostEl);
	}

	public removeSection(): void {
		this.section?.remove();
		this.section = null;
	}
}
