import type { Calendar } from '../../../common/calendar';
import { DAYS_PER_YEAR, roundToCents } from '../../../common/money';
import { InterestCost } from '../models/interestCost';

/** A payment toward a loan, amount positive. */
export interface LoanPayment {
	date: string;
	amount: number;
}

/** A loan's balance as last entered, and what's been paid toward it since. */
export interface LoanBalanceSince {
	owed: number;
	/** Yearly, as a percentage. 0 for a loan without interest. */
	rate: number;
	/** The day the balance was last entered. */
	balanceDate: string;
	/** Payments posted after that day. */
	payments: readonly LoanPayment[];
}

/**
 * What a loan owes today: simple daily interest on the principal, with each payment covering the interest built up so
 * far before the principal. Federal student, auto and most personal loans charge interest this way.
 */
export class LoanBalanceEstimator {
	public constructor(private readonly calendar: Calendar) {}

	/** What it owes at the end of `asOfDate`, today by default. Rounded to the cent; can't go below $0. */
	public estimate({ owed, rate, balanceDate, payments }: LoanBalanceSince, asOfDate = this.calendar.today()): number {
		let principal = owed;
		let unpaidInterest = 0;
		let accruedThrough = balanceDate;
		const accrueTo = (date: string) => {
			const days = Math.max(0, this.calendar.daysBetween(accruedThrough, date));
			unpaidInterest += (InterestCost.yearlyOf({ owed: Math.max(0, principal), rate }) * days) / DAYS_PER_YEAR;
			accruedThrough = date > accruedThrough ? date : accruedThrough;
		};

		for (const payment of payments.filter(each => each.date <= asOfDate).toSorted((a, b) => a.date.localeCompare(b.date))) {
			accrueTo(payment.date);
			const towardInterest = Math.min(unpaidInterest, payment.amount);
			unpaidInterest -= towardInterest;
			principal -= payment.amount - towardInterest;
		}
		accrueTo(asOfDate);
		return Math.max(0, roundToCents(principal + unpaidInterest));
	}
}
