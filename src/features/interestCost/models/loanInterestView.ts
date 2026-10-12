import type { EnteredBalance } from '../../../monarch/api/models/loanBalances';

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
			/** Payments posted since the balance was entered, from the loan's Loan payment items on Recurring. */
			paymentsSince: { date: string; amount: number }[];
			/** Null without a rate. */
			estimate: number | null;
			/** Whether a Loan payment on Recurring is tied to this loan. */
			hasLoanPayment: boolean;
	  };
