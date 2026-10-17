/** An account with just enough fields to find Wingspan's own account. */
export interface AccountSummary {
	id: string;
	displayName: string;
	isHidden: boolean;
	type: { name: string };
}

/** An account as it syncs with its bank. */
export interface SyncedAccount {
	id: string;
	displayName: string;
	isHidden: boolean;
	isManual: boolean;
	syncDisabled: boolean;
	/** When Monarch last updated the account from its bank. */
	displayLastUpdatedAt: string | null;
	/** Set when the bank connection needs the household, like signing in again. */
	credential: { updateRequired: boolean; disconnectedFromDataProviderAt: string | null } | null;
}

export interface Account {
	id: string;
	displayName: string;
	logoUrl?: string | null;
	currentBalance: number | null;
	isAsset: boolean;
	isHidden: boolean;
	type: { name: string; display: string };
	/** Monarch's finer kind of account, like "health_savings_account". */
	subtype?: { name: string } | null;
	apr?: number | null;
	interestRate?: number | null;
	/** As entered in Monarch; dataProviderCreditLimit is what the bank reports. */
	limit?: number | null;
	dataProviderCreditLimit?: number | null;
	minimumPayment?: number | null;
	/** Set when the account belongs to one of the household's businesses in Monarch. */
	businessEntity?: { id: string } | null;
	/** Whether the household enters its balance by hand, rather than Monarch syncing it. */
	isManual?: boolean;
}

/** An account's notes, where Wingspan keeps the household's data. */
export interface AccountNotes {
	notes: string | null;
}

/** Input for creating a manual account, used for the account Wingspan stores its data in. */
export interface CreateManualAccountInput {
	type: string;
	subtype: string;
	name: string;
	displayBalance: number;
	includeInNetWorth: boolean;
}

/** The account to change and the fields to change on it; any left out stay as they are. */
export interface UpdateAccountInput {
	id: string;
	notes?: string;
	hideFromList?: boolean;
	name?: string;
}
