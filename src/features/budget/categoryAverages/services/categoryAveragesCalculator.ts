import type { Calendar } from '../../../../common/calendar';
import type { CategoryMonthTotal } from '../../../../monarch/api/models/categoryMonthTotal';
import type { CategoryAverages } from '../models/categoryAverages';

/** The most months any average looks back. */
const AVERAGED_MONTHS = 12;
/** The shorter average, for recent changes in spending. */
const SHORT_AVERAGE_MONTHS = 3;

/**
 * Averages a category's monthly totals over the full months before the current one, as Monarch's own six-month
 * "Monthly average" does, and totals this year so far. Each average is its months' total divided by their count, unrounded.
 */
export class CategoryAveragesCalculator {
	public constructor(private readonly calendar: Calendar) {}

	/** The first and last dates read: the start of the month a year back through the end of this one. */
	public dates(): { startDate: string; endDate: string } {
		const currentMonth = this.calendar.currentMonth();
		return { startDate: `${this.calendar.addMonths(currentMonth, -AVERAGED_MONTHS)}-01`, endDate: this.calendar.lastOfMonth(currentMonth) };
	}

	public averages(categoryId: string, totals: readonly CategoryMonthTotal[]): CategoryAverages {
		const currentMonth = this.calendar.currentMonth();
		const amountByMonth = new Map<string, number>();
		for (const total of totals) {
			if (total.categoryId !== categoryId) continue;
			amountByMonth.set(total.month, (amountByMonth.get(total.month) ?? 0) + total.amount);
		}
		// The total of the given number of months ending with the month that many back from `lastMonthsBack`.
		const sumOver = (monthCount: number, lastMonthsBack: number) => {
			let sum = 0;
			for (let monthsBack = lastMonthsBack; monthsBack < lastMonthsBack + monthCount; monthsBack++) sum += amountByMonth.get(this.calendar.addMonths(currentMonth, -monthsBack)) ?? 0;
			return sum;
		};
		const averageOver = (monthCount: number) => sumOver(monthCount, 1) / monthCount;

		const fullMonthsThisYear = Number(currentMonth.slice(5, 7)) - 1;
		return {
			threeMonths: averageOver(SHORT_AVERAGE_MONTHS),
			twelveMonths: averageOver(AVERAGED_MONTHS),
			yearToDate: fullMonthsThisYear ? averageOver(fullMonthsThisYear) : null,
			thisYear: sumOver(fullMonthsThisYear + 1, 0)
		};
	}
}
