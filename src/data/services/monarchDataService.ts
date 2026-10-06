import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { Calendar } from '../../common/calendar';
import { logError } from '../../common/log';
import { isCoolingDown } from '../../common/syncedQueries';
import type { Account } from '../../monarch/api/models/account';
import type { RecurringFlow } from '../../monarch/api/models/recurringFlow';
import type { Transaction } from '../../monarch/api/models/transaction';
import type { MonarchAccountsClient } from '../../monarch/api/monarchAccountsClient';
import type { MonarchRecurringClient } from '../../monarch/api/monarchRecurringClient';
import type { MonarchTransactionsClient } from '../../monarch/api/monarchTransactionsClient';
import type { BalancesByAccountId } from '../models/balancesByAccountId';

const SNAPSHOT_QUERY = 'monarchSnapshot';
const TRANSACTION_HISTORY_MONTHS = 12;
const TRANSACTION_PADDING_DAYS = 10;

/** Months of history for spending pace, so its recurring payments are known on every account they were paid from. */
const RECURRING_FLOWS_HISTORY_MONTHS = 4;

/** What the features read from Monarch, fetched together: a year of transactions, accounts, amounts owed and recurring payments. */
export interface MonarchSnapshot {
	transactions: Transaction[];
	accounts: Account[];
	owedByAccountId: BalancesByAccountId;
	recurringFlows: RecurringFlow[];
	/** When Monarch answered, epoch milliseconds. */
	fetchedAt: number;
}

/** Monarch data state for a page: still loading, failed with nothing to show, or a snapshot that's marked stale if its refresh failed. */
export type MonarchDataState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; snapshot: MonarchSnapshot; isStale: boolean };

/** Monarch data shared by features, fetched as one snapshot that's cached while fresh and refetched each day. */
export class MonarchDataService {
	private readonly current = signal<MonarchSnapshot | null>(null);
	private readonly isLoadingFirstTimeSignal = signal(false);
	private readonly refreshFailed = signal(false);
	private readonly currentState = computed((): MonarchDataState => {
		const snapshot = this.current.value;
		if (snapshot) return { status: 'ready', snapshot, isStale: this.refreshFailed.value };
		return this.isLoadingFirstTimeSignal.value ? { status: 'loading' } : { status: 'failed' };
	});

	public constructor(
		private readonly queryClient: QueryClient,
		private readonly transactionsClient: MonarchTransactionsClient,
		private readonly accountsClient: MonarchAccountsClient,
		private readonly recurringClient: MonarchRecurringClient,
		private readonly calendar: Calendar,
		/** How far ahead Monarch's recurring items are fetched: the full Projected balances range. */
		private readonly recurringHorizonDays: number
	) {}

	/** The latest snapshot, null until the first one loads. A failed refresh keeps the last one. */
	public get snapshot(): ReadonlySignal<MonarchSnapshot | null> {
		return this.current;
	}

	public get state(): ReadonlySignal<MonarchDataState> {
		return this.currentState;
	}

	/** When the tab regains focus (e.g. after signing in again), retries Monarch right away instead of waiting out the cooldown. */
	public forgetFailure(): void {
		const queryKey = this.queryKey();
		if (this.queryClient.getQueryState(queryKey)?.status === 'error') this.queryClient.removeQueries({ queryKey, exact: true });
	}

	/** Fetches a snapshot unless a fresh one is cached. Never rejects. After a failure, waits for the cooldown before retrying. */
	public async load(): Promise<void> {
		const queryKey = this.queryKey();
		const queryState = this.queryClient.getQueryState(queryKey);
		if (isCoolingDown(queryState)) return;
		if (this.current.value === null && !queryState) this.isLoadingFirstTimeSignal.value = true;

		try {
			this.current.value = await this.queryClient.query({ queryKey, queryFn: () => this.fetchSnapshot() });
			this.refreshFailed.value = false;
		} catch (error) {
			logError(error);
			this.refreshFailed.value = this.current.value !== null;
		} finally {
			this.isLoadingFirstTimeSignal.value = false;
		}
	}

	/** Monarch's accounts from the snapshot, loading it first if needed. Empty when it can't load. */
	public async getAccounts(): Promise<Account[]> {
		await this.load();
		return this.current.value?.accounts ?? [];
	}

	/** Refetches on a new day. */
	private queryKey(): string[] {
		return [SNAPSHOT_QUERY, this.calendar.today()];
	}

	private async fetchSnapshot(): Promise<MonarchSnapshot> {
		const today = this.calendar.today();
		const currentMonth = this.calendar.monthOf(today);
		const earliestMonth = this.calendar.addMonths(currentMonth, -(TRANSACTION_HISTORY_MONTHS - 1));
		const transactionsStart = this.calendar.addDays(`${earliestMonth}-01`, -TRANSACTION_PADDING_DAYS);
		const flowsEnd = this.calendar.addDays(today, this.recurringHorizonDays);

		const [transactions, accounts, recurringFlows] = await Promise.all([
			this.transactionsClient.getTransactions(transactionsStart, today),
			this.accountsClient.getAccounts(),
			this.recurringClient.getRecurringFlows(`${this.calendar.addMonths(currentMonth, -RECURRING_FLOWS_HISTORY_MONTHS)}-01`, flowsEnd)
		]);

		return { transactions, accounts, owedByAccountId: this.owedByAccountId(accounts), recurringFlows, fetchedAt: Date.now() };
	}

	/**
	 * Monarch reports liabilities as negative balances. Owed is the positive amount, or negative for a credit balance.
	 * Accounts with no balance are left out, since we can't assume they owe nothing.
	 */
	private owedByAccountId(accounts: Account[]): BalancesByAccountId {
		const liabilities = accounts.filter(account => !account.isAsset && account.currentBalance !== null);
		return Object.fromEntries(liabilities.map(account => [account.id, -(account.currentBalance ?? 0)]));
	}
}
