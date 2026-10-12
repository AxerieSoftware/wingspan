import type { Calendar } from '../../../common/calendar';
import { DAYS_PER_YEAR, roundToCents } from '../../../common/money';
import { InterestCost } from '../models/interestCost';

/** A loan's balance as last entered, and what's been paid toward it since. */
export interface LoanBalanceSince {
	owed: number;
	/** Yearly, as a percentage. */
	rate: number;
	/** The day the balance was last entered. */
	balanceDate: string;
	/** Payments posted after that day, each positive. */
	payments: readonly number[];
}

/**
 * What a loan owes today: what it owed, plus simple daily interest on that since, minus payments since. Federal student,
 * auto and most personal loans charge interest this way, and payments cover the interest first.
 */
export class LoanBalanceEstimator {
	public constructor(private readonly calendar: Calendar) {}

	/** Rounded to the cent; can't go below $0. */
	public estimate({ owed, rate, balanceDate, payments }: LoanBalanceSince): number {
		const days = Math.max(0, this.calendar.daysBetween(balanceDate, this.calendar.today()));
		const interest = (InterestCost.yearlyOf({ owed, rate }) * days) / DAYS_PER_YEAR;
		const paid = payments.reduce((total, payment) => total + payment, 0);
		return Math.max(0, roundToCents(owed + interest - paid));
	}
}
