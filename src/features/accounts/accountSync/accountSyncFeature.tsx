import type { QueryClient } from '@tanstack/query-core';
import { logError } from '../../../common/log';
import type { SyncedQueries } from '../../../common/syncedQueries';
import type { SyncScheduler } from '../../../common/syncScheduler';
import type { SyncedAccount } from '../../../monarch/api/models/account';
import type { MonarchAccountsClient } from '../../../monarch/api/monarchAccountsClient';
import { MonarchApiError } from '../../../monarch/api/monarchApiError';
import type { AccountsPage } from '../../../monarch/pages/accounts/accountsPage';
import type { PageHeader } from '../../../monarch/pages/header/pageHeader';
import { Island } from '../../../monarch/ui/components/island';
import type { ToastService } from '../../../monarch/ui/components/toast';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import { SyncStatusNote } from './components/syncStatusNote';
import { type SyncSummary, summarizeSync } from './models/syncSummary';

const SYNC_STATUS_NOTE = 'syncStatus';
const SYNC_STATUS_QUERY = 'monarchSyncStatus';
const TRANSACTIONS_PATH = '/transactions';
const REFRESH_CHECK_INTERVAL_MS = 3000;
/** Monarch's refresh can take a while for slow banks; after this, the accounts are read again and the household is told it's still going. */
const REFRESH_WAIT_LIMIT_MS = 3 * 60_000;
/** The note's times read in minutes at the finest, so it rerenders at most once a minute while nothing else changes. */
const RENDER_INTERVAL_MS = 60_000;

/** On Transactions: how long ago the accounts synced, so it's clear how current the list is, and a button to refresh them all. */
export class AccountSyncFeature implements WingspanFeature {
	private readonly refreshAbort = new AbortController();
	private isRefreshing = false;
	private noteIsland: Island | null = null;
	private renderedKey = '';
	private renderedSummary: SyncSummary | null = null;
	/** Sync runs on every change to the page, so the summary is worked out again only when Monarch's accounts load again. */
	private summary: { accounts: SyncedAccount[]; value: SyncSummary | null } | null = null;

	public constructor(
		private readonly window: Window,
		private readonly pageHeader: PageHeader,
		private readonly accountsPage: AccountsPage,
		private readonly accountsClient: MonarchAccountsClient,
		private readonly queries: SyncedQueries,
		private readonly queryClient: QueryClient,
		private readonly toastService: ToastService,
		private readonly syncScheduler: SyncScheduler,
		private readonly formatter: Formatter
	) {}

	public start(): void {}

	public sync(): void {
		if (!this.pageHeader.path.startsWith(TRANSACTIONS_PATH)) {
			this.pageHeader.removeNote(SYNC_STATUS_NOTE);
			return;
		}

		const accounts = this.queries.read([SYNC_STATUS_QUERY], () => this.accountsClient.getSyncedAccounts());
		const summary = accounts.status === 'ready' ? this.summarize(accounts.data) : null;
		if (!summary) {
			this.pageHeader.removeNote(SYNC_STATUS_NOTE);
			return;
		}

		this.pageHeader.showNote(SYNC_STATUS_NOTE, { render: noteEl => this.mountNote(noteEl) });
		this.renderNote(summary);
	}

	public suspend(): void {
		this.pageHeader.removeNote(SYNC_STATUS_NOTE);
	}

	public [Symbol.dispose](): void {
		this.refreshAbort.abort();
		this.pageHeader.removeNote(SYNC_STATUS_NOTE);
	}

	private summarize(accounts: SyncedAccount[]): SyncSummary | null {
		if (this.summary?.accounts !== accounts) this.summary = { accounts, value: summarizeSync(accounts) };
		return this.summary.value;
	}

	private mountNote(noteEl: HTMLElement): () => void {
		this.noteIsland = new Island(noteEl);
		this.renderedKey = '';
		this.renderedSummary = null;
		return () => {
			this.noteIsland?.unmount();
			this.noteIsland = null;
		};
	}

	private renderNote(summary: SyncSummary): void {
		const now = Date.now();
		const renderKey = `${this.isRefreshing}|${Math.floor(now / RENDER_INTERVAL_MS)}`;
		if (renderKey === this.renderedKey && summary === this.renderedSummary) return;

		this.renderedKey = renderKey;
		this.renderedSummary = summary;
		this.noteIsland?.render(
			<SyncStatusNote
				summary={summary}
				isRefreshing={this.isRefreshing}
				now={now}
				formatter={this.formatter}
				onRefresh={() => void this.refreshAllAccounts()}
				onOpenAccounts={() => this.accountsPage.open()}
			/>
		);
	}

	/** Refreshes like Monarch's Refresh all on Accounts, then offers a reload, since Monarch's list only shows new transactions once it's fetched again. */
	private async refreshAllAccounts(): Promise<void> {
		this.setRefreshing(true);
		try {
			const refreshId = await this.accountsClient.refreshAllAccounts();
			const isComplete = refreshId ? await this.waitForRefresh(refreshId) : true;
			await this.queryClient.invalidateQueries({ queryKey: [SYNC_STATUS_QUERY] });
			if (!isComplete) {
				this.toastService.show({ title: 'Still refreshing', description: 'Some banks are taking a while. Reload in a few minutes to see new transactions.', icon: 'bell' });
				return;
			}
			this.toastService.show({
				title: 'Accounts refreshed',
				description: 'Reload the page to see new transactions.',
				icon: 'bell',
				action: { label: 'Reload', onClick: () => this.window.location.reload() }
			});
		} catch (error) {
			if (this.refreshAbort.signal.aborted) return;
			logError(error);
			const reason = error instanceof MonarchApiError ? error.message : "Monarch couldn't be reached.";
			this.toastService.show({ title: "Couldn't refresh accounts", description: `${reason} Try again in a moment.`, icon: 'help' });
		} finally {
			this.setRefreshing(false);
		}
	}

	private setRefreshing(isRefreshing: boolean): void {
		this.isRefreshing = isRefreshing;
		this.syncScheduler.request();
	}

	/** False when Monarch is still refreshing at the limit. */
	private async waitForRefresh(refreshId: string): Promise<boolean> {
		const giveUpAt = Date.now() + REFRESH_WAIT_LIMIT_MS;
		while (Date.now() < giveUpAt) {
			await this.delay(REFRESH_CHECK_INTERVAL_MS);
			if (await this.accountsClient.isRefreshComplete(refreshId)) return true;
		}
		return false;
	}

	private delay(milliseconds: number): Promise<void> {
		const signal = this.refreshAbort.signal;
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(signal.reason);
				return;
			}
			const onAbort = () => {
				this.window.clearTimeout(timeoutId);
				reject(signal.reason);
			};
			const timeoutId = this.window.setTimeout(() => {
				signal.removeEventListener('abort', onAbort);
				resolve();
			}, milliseconds);
			signal.addEventListener('abort', onAbort, { once: true });
		});
	}
}
