import { effect } from '@preact/signals-core';
import { countOf } from '../../../common/countOf';
import type { SyncedQueries } from '../../../common/syncedQueries';
import type { SyncScheduler } from '../../../common/syncScheduler';
import type { MonarchTransactionsClient } from '../../../monarch/api/monarchTransactionsClient';
import type { SidebarPage } from '../../../monarch/pages/sidebar/sidebarPage';
import type { BusinessEntityView } from '../../businessEntities/services/businessEntityView';
import type { WingspanFeature } from '../../wingspanFeature';
import { SidebarCountBadge } from '../sidebarCountBadge';

const TRANSACTIONS_PATH = '/transactions';
const NEEDS_REVIEW_QUERY = 'monarchNeedsReviewCount';
/** Reviewing happens on Monarch's page without Wingspan seeing it, so the count is checked again this often as pages change. */
const COUNT_FRESH_MS = 60_000;

/** How many transactions need reviewing, as a count on Transactions in the sidebar, for the workspace shown. Hidden at 0. */
export class NeedsReviewBadgeFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly transactionsBadge: SidebarCountBadge;

	public constructor(
		sidebar: SidebarPage,
		private readonly transactionsClient: MonarchTransactionsClient,
		private readonly syncedQueries: SyncedQueries,
		private readonly businessView: BusinessEntityView,
		private readonly syncScheduler: SyncScheduler
	) {
		this.transactionsBadge = new SidebarCountBadge(sidebar, TRANSACTIONS_PATH);
	}

	/** Syncs again when the workspace changes, so the count follows it. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void this.businessView.scope.value;
				this.syncScheduler.request();
			})
		);
	}

	public sync(): void {
		const businessEntitySet = this.businessView.scope.peek().toBusinessEntitySet();
		const count = this.syncedQueries.read([NEEDS_REVIEW_QUERY, businessEntitySet ?? null], () => this.transactionsClient.getNeedsReviewCount(businessEntitySet), {
			staleTimeMs: COUNT_FRESH_MS
		});
		if (count.status === 'ready') this.transactionsBadge.show(count.data, `${countOf(count.data, 'transaction')} to review`);
		else this.transactionsBadge.remove();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.transactionsBadge.remove();
	}
}
