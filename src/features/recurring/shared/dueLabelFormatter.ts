import { LAST_DAY_OF_MONTH } from '../../../common/calendar';
import type { Formatter } from '../../../monarch/ui/formatter';

/** Due date text for recurring rows, shared by Monarch's items and Wingspan's so they read the same. */
export class DueLabelFormatter {
	/** For an item due more than once in the month, with every date paid. */
	public readonly allPaid = 'All paid';

	public constructor(private readonly formatter: Formatter) {}

	/** For an item due once in the month. */
	public due(dueDate: string): string {
		return `Due ${this.formatter.shortDate(dueDate)}`;
	}

	/** For an item due more than once in the month: its next unpaid date. */
	public next(dueDate: string): string {
		return `Next ${this.formatter.shortDate(dueDate)}`;
	}

	/** For the All view, which has no month: the day of the month it's due. */
	public dueOnDay(dayOfMonth: number): string {
		// Matches the day picker: the 31st means the last day of every month.
		return dayOfMonth === LAST_DAY_OF_MONTH ? 'Due the last day' : `Due the ${this.formatter.ordinal(dayOfMonth)}`;
	}
}
