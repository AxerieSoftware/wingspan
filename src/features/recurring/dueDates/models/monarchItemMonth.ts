import type { RecurrenceGroupPeriod } from '../../../../monarch/api/models/recurrenceGroupPeriod';

/** One of Monarch's recurring items for a month: its occurrences that month, whether it repeats within the month, and whether they're all paid. */
export interface MonarchItemMonth {
	group: RecurrenceGroupPeriod;
	occurrences: RecurrenceGroupPeriod['occurrences'];
	repeatsInMonth: boolean;
	isAllPaid: boolean;
}
