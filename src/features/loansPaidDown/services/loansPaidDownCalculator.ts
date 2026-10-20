import { CENTS_PER_DOLLAR, toCents } from '../../../common/money';
import type { LoanBalances } from '../../../monarch/api/models/loanBalances';
import { type EntityScope, entityIdOf } from '../../businessEntities/models/entityScope';
import { loanRateOf } from '../../interestCost/models/interestCost';
import type { LoanBalanceEstimator, LoanPayment } from '../../interestCost/services/loanBalanceEstimator';
import type { LoanPaydown, LoansPaidDown } from '../models/loansPaidDown';

type TrackedLoan = LoanBalances & { startBalance: number };

/** The payments posted to manual loans that a Monarch recurring expense is linked to, for the period being shown. */
export interface ManualLoanPayments {
	/** The day before the period starts, whose end-of-day balance is the starting balance. */
	balanceStartDate: string;
	/** The last day counted. */
	throughDate: string;
	/** Each linked manual loan's payments. Only loans whose payments are all known for the period are listed. */
	paymentsByLoanId: ReadonlyMap<string, readonly LoanPayment[]>;
}

/**
 * Debt paydown is the drop in what the loans owe from the period's start to its end: payments minus interest added.
 * Balances are negative while owed, so a smaller debt is a higher balance, and a loan closed during the period ends at
 * its current balance. Invariant: the total is exactly the sum of each loan's paydown, to the cent.
 */
export class LoansPaidDownCalculator {
	public constructor(private readonly estimator: LoanBalanceEstimator) {}

	/** Null when no loan shown had a balance at the period's start. Income is the period's, for the share of income. */
	public calculate(loans: readonly LoanBalances[], income: number, scope: EntityScope, manualPayments: ManualLoanPayments | null): LoansPaidDown | null {
		const counted = loans.filter((loan): loan is TrackedLoan => loan.startBalance !== null && scope.includes(entityIdOf(loan)));
		if (!counted.length) return null;

		const loanPaydowns = counted.map(loan => {
			const estimatedEndBalance = this.estimatedEndBalance(loan, manualPayments);
			const endingBalance = estimatedEndBalance ?? loan.endBalance ?? loan.currentBalance;
			return { name: loan.displayName, cents: toCents(endingBalance - loan.startBalance), isFromPayments: estimatedEndBalance !== null };
		});
		const totalCents = loanPaydowns.reduce((total, loan) => total + loan.cents, 0);
		const amount = totalCents / CENTS_PER_DOLLAR;
		return {
			amount,
			shareOfIncome: income > 0 ? amount / income : null,
			loans: loanPaydowns
				.map((loan): LoanPaydown => ({ name: loan.name, amount: loan.cents / CENTS_PER_DOLLAR, isFromPayments: loan.isFromPayments }))
				.sort((first, second) => second.amount - first.amount)
		};
	}

	/**
	 * A linked manual loan's balance at the period's end, worked out from its payments and simple interest, since its
	 * balance only changes when the household enters one. Null for any other loan, which uses Monarch's balance.
	 */
	private estimatedEndBalance(loan: TrackedLoan, manualPayments: ManualLoanPayments | null): number | null {
		if (!loan.isManual || !manualPayments) return null;
		const payments = manualPayments.paymentsByLoanId.get(loan.accountId);
		if (!payments) return null;
		const { balanceStartDate, throughDate } = manualPayments;
		const paymentsInPeriod = payments.filter(payment => payment.date > balanceStartDate && payment.date <= throughDate);
		return -this.estimator.estimate({ owed: -loan.startBalance, rate: loanRateOf(loan) ?? 0, balanceDate: balanceStartDate, payments: paymentsInPeriod }, throughDate);
	}
}
