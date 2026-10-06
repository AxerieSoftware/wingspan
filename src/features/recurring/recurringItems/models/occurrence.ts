import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { RecurringItem } from './recurringItem';

/** One due date of an item. `carried` means it fell before this month; `overdue` means it's unpaid past its date. */
export interface Occurrence {
	item: RecurringItem;
	dueDate: string;
	key: string;
	amount: number;
	paid: boolean;
	matchedTransaction: Transaction | null;
	carried: boolean;
	overdue: boolean;
}
