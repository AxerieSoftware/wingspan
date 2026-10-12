import type { Calendar } from '../../../common/calendar';
import { MONTHS_PER_YEAR } from '../../../common/money';
import type { CashFlowTimeframe } from '../../../monarch/pages/cashFlow/cashFlowPage';

const MONTHS_PER_QUARTER = 3;

/** The month, quarter or year Cash Flow totals, as inclusive dates. */
export class CashFlowPeriod {
	private constructor(
		public readonly startDate: string,
		public readonly endDate: string
	) {}

	/** The period starting on the page's date, or the one holding today when the page shows the current period. */
	public static of(timeframe: CashFlowTimeframe, periodStart: string | null, calendar: Calendar): CashFlowPeriod {
		const month = calendar.monthOf(periodStart ?? calendar.today());
		const firstMonth = CashFlowPeriod.firstMonthOf(timeframe, month);
		const lastMonth = calendar.addMonths(firstMonth, CashFlowPeriod.monthsIn(timeframe) - 1);
		return new CashFlowPeriod(`${firstMonth}-01`, calendar.lastOfMonth(lastMonth));
	}

	private static firstMonthOf(timeframe: CashFlowTimeframe, month: string): string {
		if (timeframe === 'year') return `${month.slice(0, 4)}-01`;
		if (timeframe === 'month') return month;
		const quarterFirstMonth = Math.floor((Number(month.slice(5, 7)) - 1) / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER + 1;
		return `${month.slice(0, 4)}-${String(quarterFirstMonth).padStart(2, '0')}`;
	}

	private static monthsIn(timeframe: CashFlowTimeframe): number {
		if (timeframe === 'year') return MONTHS_PER_YEAR;
		if (timeframe === 'quarter') return MONTHS_PER_QUARTER;
		return 1;
	}
}
