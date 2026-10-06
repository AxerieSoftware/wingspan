/** A row Wingspan adds to the list: `key` is the item id plus "@" and a date, so one item can appear more than once. */
export interface RecurringV2WingspanRow {
	key: string;
	label: string;
	sortDate: string;
	sectionName: string;
	inStatements: boolean;
	selected: boolean;
	onOpen(): void;
}

export interface RecurringV2WingspanRows {
	rows: RecurringV2WingspanRow[];
	statementsFooterText: string | null;
	/** Shown in the Statements card when no row goes there; without it the card keeps Monarch's own content. */
	statementsEmptyText: string | null;
}
