/** One of Monarch's recurring items, as shown in its row. */
export interface RecurringV2Item {
	readonly name: string;
	readonly statusDay: number | null;
	/** The amount the row shows, unsigned; null when it shows none. */
	readonly amount: number | null;
}

/** A row's due label and the YYYY-MM-DD date it sorts by; a null date sorts after the dated rows. */
export interface RecurringV2DueDate {
	label: string;
	date: string | null;
}
