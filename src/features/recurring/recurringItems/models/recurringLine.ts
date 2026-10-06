import type { Occurrence } from './occurrence';
import type { RecurringItem } from './recurringItem';

/** One of Wingspan's rows on Recurring, with the occurrences it covers and their combined state. */
export interface RecurringLine {
	item: RecurringItem;
	key: string;
	occurrences: Occurrence[];
	dueDate: string;
	paid: boolean;
	overdue: boolean;
	carried: boolean;
	amount: number;
	/** The amount owed is unknown, e.g. a card with no Monarch balance and no typical payment. Its amount isn't $0. */
	amountUnknown?: boolean;
	lastPaidDate: string | null;
	nextDueDate: string | null;
}
