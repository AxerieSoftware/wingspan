/** One time a recurring item is due, its amount and account when Monarch has them. */
export interface RecurringFlowOccurrence {
	date: string;
	status: string;
	amount: number | null;
	account: { id: string } | null;
}

/** A recurring item with its occurrences in a period, amounts and accounts included. */
export interface RecurringFlow {
	occurrences: RecurringFlowOccurrence[];
	/** Set when only some occurrences are kept: every occurrence Monarch returned, for logic that needs all of them. */
	allOccurrences?: RecurringFlowOccurrence[];
	recurrenceGroup: { id: string; name: string; recurringType: string; amount: number | null; account: { id: string } | null; merchant: { id: string } | null };
}

interface AccountReference {
	account: { id: string } | null;
}

/** An occurrence's account is its own when Monarch provides one, otherwise its recurring item's. */
export const occurrenceAccountId = (flow: { recurrenceGroup: AccountReference }, occurrence: AccountReference): string | undefined => occurrence.account?.id ?? flow.recurrenceGroup.account?.id;

/** Every account a recurring item is paid from: its occurrences', or its own when it has none. Undefined for no account. */
export function paidFromAccountIds(flow: { recurrenceGroup: AccountReference; occurrences: readonly AccountReference[] }): (string | undefined)[] {
	const accountIds = flow.occurrences.length ? flow.occurrences.map(occurrence => occurrenceAccountId(flow, occurrence)) : [flow.recurrenceGroup.account?.id];
	return [...new Set(accountIds)];
}
