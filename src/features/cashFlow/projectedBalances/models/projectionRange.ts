import type { CashFlowTimeframe } from '../../../../monarch/pages/cashFlow/cashFlowPage';
import type { CardForecast, ProjectedDay, Projection, ProjectionEvent, ProjectionEventKind } from './projection';

const QUARTER_DAYS = 90;

/** The slice of a projection the chart shows for Cash Flow's timeframe: month runs to the end of the reversible window, quarter runs 90 days, year shows everything. */
export class ProjectionRange {
	/** The last day shown, inclusive. */
	public readonly endDate: string;
	/** The burndown days through endDate. */
	public readonly days: ProjectedDay[];
	/** The burndown events through endDate. */
	public readonly events: ProjectionEvent[];

	public constructor(
		private readonly projection: Projection,
		timeframe: CashFlowTimeframe
	) {
		this.endDate = this.endDateOf(timeframe);
		this.days = projection.burndown.days.filter(day => day.date <= this.endDate);
		this.events = projection.burndown.events.filter(event => event.date <= this.endDate);
	}

	/** From the cash-only days, so borrowing on cards or drawing on reserves doesn't count as money gained. */
	public get closingCashDay(): ProjectedDay | undefined {
		return this.projection.days.findLast(day => day.date <= this.endDate);
	}

	/** Null when no counted card has a known limit. */
	public get lowestCreditLeft(): number | null {
		const creditLeft = this.days.map(day => day.creditLeft).filter(amount => amount !== null);
		return creditLeft.length ? Math.min(...creditLeft) : null;
	}

	/** The highest share of the counted cards' limits in use, over 100% when they're over their limits. Null without a known limit. */
	public get peakUtilization(): number | null {
		const { creditLimit } = this.projection;
		if (!creditLimit || !this.days.length) return null;
		return Math.max(...this.days.map(day => day.creditUsed)) / creditLimit;
	}

	/** Cards with a balance but no known due date, which are assumed due 30 days out. */
	public get cardsWithoutDueDate(): CardForecast[] {
		return this.projection.cards.filter(card => !card.hasDueDate && card.owedToday > 0);
	}

	/** Cards counted as $0 because their balance is unknown. */
	public get cardsWithoutAmount(): CardForecast[] {
		return this.projection.cards.filter(card => !card.hasAmount);
	}

	public firstEvent(kind: ProjectionEventKind): ProjectionEvent | undefined {
		return this.events.find(event => event.kind === kind);
	}

	private endDateOf(timeframe: CashFlowTimeframe): string {
		const { days } = this.projection.burndown;
		const reversibleEnd = this.projection.reversible.endDate;
		if (timeframe === 'quarter') return days[QUARTER_DAYS]?.date ?? days.at(-1)?.date ?? reversibleEnd;
		if (timeframe === 'year') return days.at(-1)?.date ?? reversibleEnd;
		return reversibleEnd;
	}
}
