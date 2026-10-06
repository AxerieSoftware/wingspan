/** One recurring item in a period: when it's due next and the status of each occurrence. */
export interface RecurrenceGroupPeriod {
	status: string;
	date: string | null;
	nextDate: string | null;
	occurrences: { date: string; status: string }[];
	recurrenceGroup: { id: string; name: string; frequency: string; isActive: boolean };
}
