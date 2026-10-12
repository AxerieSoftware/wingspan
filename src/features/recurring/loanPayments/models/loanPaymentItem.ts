import type { RecurringItem } from '../../recurringItems/models/recurringItem';

export const LOAN_PAYMENT_KIND = 'loan';

/** A loan's monthly payment. It owes its own amount each due date, not the loan's balance. */
export interface LoanPaymentItem extends RecurringItem {
	kind: typeof LOAN_PAYMENT_KIND;
	/** The Monarch loan account the payment goes toward. */
	loanAccountId?: string;
}
