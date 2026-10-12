import { roundToCents } from '../../../common/money';
import type { LoanBalances } from '../../../monarch/api/models/loanBalances';
import { type EntityScope, entityIdOf } from '../../businessEntities/models/entityScope';
import type { LoanPaydown, LoansPaidDown } from '../models/loansPaidDown';

const CENTS_PER_DOLLAR = 100;

type TrackedLoan = LoanBalances & { startBalance: number };

/**
 * Debt paydown is the drop in what the loans owe from the period's start to its end: payments minus interest added.
 * Invariant: the total is exactly the sum of each loan's paydown, to the cent.
 */
export class LoansPaidDownCalculator {
	/** Null when no loan shown had a balance at the period's start. Income is the period's, for the share of income. */
	public calculate(loans: readonly LoanBalances[], income: number, scope: EntityScope): LoansPaidDown | null {
		const counted = loans.filter((loan): loan is TrackedLoan => loan.startBalance !== null && scope.includes(entityIdOf(loan)));
		if (!counted.length) return null;

		const loanPaydowns = counted.map(loan => ({ name: loan.displayName, cents: this.paydownCents(loan) }));
		const totalCents = loanPaydowns.reduce((total, loan) => total + loan.cents, 0);
		const amount = totalCents / CENTS_PER_DOLLAR;
		return {
			amount,
			shareOfIncome: income > 0 ? amount / income : null,
			loans: loanPaydowns.map((loan): LoanPaydown => ({ name: loan.name, amount: loan.cents / CENTS_PER_DOLLAR })).sort((first, second) => second.amount - first.amount)
		};
	}

	/** Balances are negative while owed, so a smaller debt is a higher balance. A loan with no balance at the end was closed, so it owes its current balance. */
	private paydownCents({ startBalance, endBalance, currentBalance }: TrackedLoan): number {
		const endingBalance = endBalance ?? currentBalance;
		return Math.round(roundToCents(endingBalance - startBalance) * CENTS_PER_DOLLAR);
	}
}
