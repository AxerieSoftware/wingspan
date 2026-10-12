import type { Formatter } from '../../../monarch/ui/formatter';
import { InterestCost } from '../models/interestCost';

/** The tooltip for an interest cost: its day, month and year, and each debt's rate and month. */
export function describeInterestCost(cost: InterestCost, formatter: Formatter): string {
	const totals = `${formatter.money(cost.daily)} a day, ${formatter.wholeMoney(cost.monthly)} a month, ${formatter.wholeMoney(cost.yearly)} a year`;
	const byDebt = cost.debts
		.map(debt => `${debt.name} at ${debt.rate.toFixed(2)}%${debt.isRateImplied ? ' (from its last interest charge)' : ''}, ${formatter.wholeMoney(new InterestCost([debt]).monthly)} a month`)
		.join('; ');
	return `Interest at today's balances: ${totals}. Cards count only while they're charged interest. By debt: ${byDebt}.`;
}
