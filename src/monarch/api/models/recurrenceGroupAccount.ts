/** A recurring item, inactive ones too, with every account it's paid from. */
export interface RecurrenceGroupAccount {
	id: string;
	name: string;
	isActive: boolean;
	recurringType: string;
	amount: number | null;
	/** The accounts it's paid from, null for none. */
	accountIds: (string | null)[];
}
