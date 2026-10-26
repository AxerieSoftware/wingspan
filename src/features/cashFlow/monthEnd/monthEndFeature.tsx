import { computed, effect } from '@preact/signals-core';
import type { ReactNode } from 'react';
import type { Calendar } from '../../../common/calendar';
import { MONTHS_PER_YEAR } from '../../../common/money';
import type { CashFlowPage } from '../../../monarch/pages/cashFlow/cashFlowPage';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import type { ProjectedBalancesService } from '../projectedBalances/services/projectedBalancesService';
import { MonthEndBars } from './components/monthEndBars';
import { MonthEndTooltipRows } from './components/monthEndTooltipRows';
import type { MonthEndCalculator } from './services/monthEndCalculator';

interface ShownIsland {
	island: Island;
	/** The props it last rendered, as JSON. */
	renderedPropsJson: string | null;
}

/** Where this month is headed, on Cash Flow's monthly bar chart: its bars extended to the projection's month end, and the totals in its tooltip. */
export class MonthEndFeature implements WingspanFeature {
	/** Worked out again only when the projection changes, not on every sync. */
	private readonly expected = computed(() => {
		const state = this.projectedBalances.state.value;
		return state.status === 'ready' && state.projection ? this.calculator.expected(state.projection) : null;
	});
	private readonly subscriptions = new DisposableStack();
	/** Each part's React root and what it last showed, so a sync that changes nothing doesn't render again. */
	private bars: ShownIsland | null = null;
	private tooltipRows: ShownIsland | null = null;

	public constructor(
		private readonly page: CashFlowPage,
		private readonly projectedBalances: ProjectedBalancesService,
		private readonly calculator: MonthEndCalculator,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	/** Projected balances loads the data; this redraws once the projection is ready or changes. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.expected.value;
				this.sync();
			})
		);
	}

	public sync(): void {
		// This month's bars are the chart's last, whichever of its months is picked. Picking the same month a year ago
		// ends the chart on a column with this month's name, so a pick that far back doesn't count.
		const thisMonth = this.calendar.currentMonth();
		const isPickedThisYear = this.calendar.monthOf(this.page.periodStart ?? this.calendar.today()) > this.calendar.addMonths(thisMonth, -MONTHS_PER_YEAR);
		const isThisMonthShown = this.page.timeframe === 'month' && isPickedThisYear && this.page.chart.lastMonthLabel === this.formatter.shortMonth(thisMonth);
		const expected = this.page.isActive && isThisMonthShown ? this.expected.value : null;
		const column = expected ? this.page.chart.column(this.formatter.shortMonth(this.calendar.currentMonth())) : null;
		if (!expected || !column) {
			this.remove();
			return;
		}

		this.page.chart.showOverlay({ render: hostElement => this.mount(hostElement, shown => (this.bars = shown)) });
		this.renderIfChanged(this.bars, [column, expected], () => <MonthEndBars column={column} expected={expected} formatter={this.formatter} />);

		const tooltip = this.page.chart.tooltip;
		const income = tooltip?.amounts.get('Income');
		const expenses = tooltip?.amounts.get('Expenses');
		if (!tooltip || tooltip.heading !== this.formatter.longMonthYear(this.calendar.today()) || income === undefined || expenses === undefined) {
			this.page.chart.removeTooltipRows();
			return;
		}
		this.page.chart.showTooltipRows({ render: hostElement => this.mount(hostElement, shown => (this.tooltipRows = shown)) });
		this.renderIfChanged(this.tooltipRows, [tooltip.look, income, expenses, expected, column.incomeColor, column.expensesColor], () => (
			<MonthEndTooltipRows
				look={tooltip.look}
				income={income + expected.income}
				expenses={expenses + expected.expenses}
				incomeColor={column.incomeColor}
				expensesColor={column.expensesColor}
				formatter={this.formatter}
			/>
		));
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.remove();
	}

	private remove(): void {
		this.page.chart.removeOverlay();
		this.page.chart.removeTooltipRows();
	}

	private renderIfChanged(shown: ShownIsland | null, props: unknown[], content: () => ReactNode): void {
		const propsJson = JSON.stringify(props);
		if (!shown || shown.renderedPropsJson === propsJson) return;
		shown.renderedPropsJson = propsJson;
		shown.island.render(content());
	}

	private mount(hostElement: HTMLElement, setShown: (shown: ShownIsland | null) => void): () => void {
		const island = new Island(hostElement);
		setShown({ island, renderedPropsJson: null });
		return () => {
			island.unmount();
			setShown(null);
		};
	}
}
