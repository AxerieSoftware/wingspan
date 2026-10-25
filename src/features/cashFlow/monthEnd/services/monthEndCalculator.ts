import type { Calendar } from '../../../../common/calendar';
import { CENTS_PER_DOLLAR, toCents } from '../../../../common/money';
import { dailyFromMonthly, type Projection } from '../../projectedBalances/models/projection';
import type { MonthEndExpectation } from '../models/monthEndExpectation';

/**
 * The income and expenses still to come this month, read from the projection.
 *
 * Invariant: income is the month's remaining income flows and expenses are its remaining bills plus everyday spending
 * at the projection's pace from tomorrow, all summed in whole cents. Card payments and money drawn to cover checking
 * move money between accounts, so they're neither.
 */
export class MonthEndCalculator {
	public constructor(private readonly calendar: Calendar) {}

	public expected(projection: Projection): MonthEndExpectation {
		const today = this.calendar.today();
		const monthEnd = this.calendar.lastOfMonth(this.calendar.currentMonth());
		let incomeCents = 0;
		let billCents = 0;
		for (const day of projection.days) {
			if (day.date > monthEnd) break;
			for (const flow of day.flows) {
				if (flow.kind === 'income') incomeCents += toCents(flow.amount);
				else if (flow.kind === 'bill') billCents -= toCents(flow.amount);
			}
		}

		// The projection spends from every account at its pace each day after today; checking's share is also listed as flows, so it's counted here instead.
		const monthlySpending = [...projection.pace.monthlyByAccountId.values()].reduce((total, monthly) => total + monthly, 0);
		const spendingCents = toCents(dailyFromMonthly(monthlySpending) * this.calendar.daysBetween(today, monthEnd));
		return { monthEnd, income: incomeCents / CENTS_PER_DOLLAR, expenses: (billCents + spendingCents) / CENTS_PER_DOLLAR };
	}
}
