import type { SyncedAccount } from '../../../../monarch/api/models/account';

/** One account's sync, for the list in the Transactions header. */
export interface AccountSyncStatus {
	id: string;
	name: string;
	/** Null when the account hasn't synced yet. */
	syncedAt: number | null;
	/** The connection needs the household, like signing in to the bank again. */
	needsAttention: boolean;
}

/** How fresh the household's synced accounts are, for the Transactions header. */
export interface SyncSummary {
	/** When an account last synced normally, or null when none has. */
	latestSyncedAt: number | null;
	/** Accounts needing attention first, then the least recently synced. */
	accounts: AccountSyncStatus[];
}

/** Null when no visible account syncs with a bank, so there's nothing to say. */
export function summarizeSync(syncedAccounts: readonly SyncedAccount[]): SyncSummary | null {
	const accounts = syncedAccounts
		.filter(account => !account.isHidden && !account.isManual && !account.syncDisabled)
		.map(toAccountSyncStatus)
		.sort(byAttentionThenOldest);
	if (accounts.length === 0) return null;

	const syncTimes = accounts.flatMap(account => (account.needsAttention || account.syncedAt === null ? [] : [account.syncedAt]));
	return { latestSyncedAt: syncTimes.length ? Math.max(...syncTimes) : null, accounts };
}

function toAccountSyncStatus(account: SyncedAccount): AccountSyncStatus {
	return {
		id: account.id,
		name: account.displayName,
		syncedAt: account.displayLastUpdatedAt ? Date.parse(account.displayLastUpdatedAt) : null,
		needsAttention: !!account.credential?.updateRequired || !!account.credential?.disconnectedFromDataProviderAt
	};
}

function byAttentionThenOldest(first: AccountSyncStatus, second: AccountSyncStatus): number {
	if (first.needsAttention !== second.needsAttention) return first.needsAttention ? -1 : 1;
	return (first.syncedAt ?? 0) - (second.syncedAt ?? 0);
}
