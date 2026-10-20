import type { EnteredBalance } from '../../../monarch/api/models/loanBalances';
import type { LoanPayment } from '../services/loanBalanceEstimator';

/** What a loan's page shows: interest at today's balance, and for a manual loan, its balance as last entered and an estimate for today. */
export interface LoanInterestView {
	accountName: string;
	owed: number;
	/** Yearly, as a percentage; null when Monarch has no rate for the loan. */
	rate: number | null;
	/** Set for a manual loan, whose balance the household enters. */
	manual: ManualLoanView | null;
}

/** Loading, failed, or none when Monarch has no balance for the loan, until the balance as last entered is known. */
export type ManualLoanView =
	| { status: 'loading' }
	| { status: 'failed' }
	| { status: 'none' }
	| {
			status: 'ready';
			entered: EnteredBalance;
			/** Payments posted since the balance was entered, from the Monarch recurring expenses that pay toward the loan. */
			paymentsSince: LoanPayment[];
			/** The balance as entered plus interest since, at 0% without a rate, minus the payments since. */
			estimate: number;
			/** Whether a Monarch recurring expense pays toward this loan. */
			hasLinkedPayment: boolean;
	  };
