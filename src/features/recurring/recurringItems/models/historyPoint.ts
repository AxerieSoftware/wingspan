import type { Transaction } from '../../../../monarch/api/models/transaction';

/** One due date in an item's payment history, or one month once `monthlyHistory` sums them. `empty` marks a month with no due date. */
export interface HistoryPoint {
	month: string;
	dueDate: string;
	paid: boolean;
	amount: number | null;
	paidDate: string | null;
	upcoming: boolean;
	transaction: Transaction | null;
	empty?: boolean;
	untracked?: boolean;
}
