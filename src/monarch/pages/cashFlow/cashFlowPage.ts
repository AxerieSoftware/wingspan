import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const CASH_FLOW_PATH = '/cash-flow';
const GOALS_PATH = '/goals';
/** The grid cell holding the chart, which both the bar and Sankey views have. */
export const CHART_GRID_ITEM_SELECTOR = '[data-external-id="grid-item"][style*="grid-area: chart"]';
const TIMEFRAMES = ['month', 'quarter', 'year'] as const;
/** Monarch keeps its Cash Flow filters in the URL as you change them, one parameter per chosen business. */
const BUSINESS_FILTER_PARAM = 'businessEntitySet';

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
 * above the date and View menu that only apply to Monarch's cards.
 */
export class CashFlowPage {
	private section: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	public get isActive(): boolean {
		return this.navigator.isUnder(CASH_FLOW_PATH);
	}

	/** The timeframe in the URL, defaulting to month when it's missing or unknown. */
	public get timeframe(): CashFlowTimeframe {
		const timeframe = new URLSearchParams(this.window.location.search).get('timeframe');
		return TIMEFRAMES.find(candidate => candidate === timeframe) ?? 'month';
	}

	/**
	 * Monarch's business filter on the Cash Flow page: business ids, plus "business_entity_none" for Household. An empty
	 * selection shows everything. Read from the URL, which Monarch updates as the filter changes; the copy it saves
	 * to session storage is written a moment later and can be stale.
	 */
	public get businessEntityFilter(): string[] {
		return new URLSearchParams(this.window.location.search).getAll(BUSINESS_FILTER_PARAM);
	}

	public open(): void {
		this.navigator.navigateTo(CASH_FLOW_PATH);
	}

	public openGoals(): void {
		this.navigator.navigateTo(GOALS_PATH);
	}

	/** Puts Wingspan's section last in the chart's cell, or removes it while the cell isn't there. */
	public showSection(content: SlotContent): void {
		const chartGridItemEl = this.window.document.querySelector<HTMLElement>(CHART_GRID_ITEM_SELECTOR);
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
