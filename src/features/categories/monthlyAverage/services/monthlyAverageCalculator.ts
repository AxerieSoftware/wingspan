import type { Calendar } from '../../../../common/calendar';
import type { SummaryPeriod } from '../../../../monarch/pages/categories/categorySummaryPage';

const MONTHS_IN_PERIOD: Partial<Record<SummaryPeriod, number>> = { quarter: 3, year: 12 };

/**
 * A category's total spread over the months Monarch's Summary covers: the picked quarter or year, or all time from the
 * first transaction. A period still going counts its months through this one, so this year's average is over the
 * months so far, the current one included.
 */
export class MonthlyAverageCalculator {
	public constructor(private readonly calendar: Calendar) {}

	/** Null for a picked day, week or month, which an average per month says nothing more about. */
	public average(total: number, period: { kind: SummaryPeriod; startDate: string } | null, firstTransactionDate: string): number | null {
		const currentMonth = this.calendar.currentMonth();
		const periodMonths = period ? MONTHS_IN_PERIOD[period.kind] : undefined;
		if (period && !periodMonths) return null;

		const startMonth = this.calendar.monthOf(period ? period.startDate : firstTransactionDate);
		const periodEndMonth = periodMonths ? this.calendar.addMonths(startMonth, periodMonths - 1) : currentMonth;
		const endMonth = periodEndMonth < currentMonth ? periodEndMonth : currentMonth;
		if (endMonth < startMonth) return null;
		return total / (this.calendar.monthsBetween(startMonth, endMonth) + 1);
	}
}
