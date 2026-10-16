import { effect } from '@preact/signals-core';
import type { SyncScheduler } from '../../common/syncScheduler';
import type { MonarchDataService } from '../../data/services/monarchDataService';
import { MonarchAccountType, MonarchRecurringType } from '../../monarch/api/models/monarchValues';
import type { RecurringV2Page } from '../../monarch/pages/recurringV2/recurringV2Page';
import type { WingspanFeature } from '../wingspanFeature';
import { type LoanChoice, PaysTowardPanelRow } from './components/paysTowardPanelRow';
import type { ManualLoanUpdates } from './services/manualLoanUpdates';

const PAYS_TOWARD_ROW = 'paysToward';

/** Adds a Pays toward row to a Monarch expense's panel on Recurring, so its payments come off a loan's estimated balance. */
export class LoanPaymentLinksFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly panelRow: PaysTowardPanelRow;
	/** Items already refetched for, so one that's still missing, like an ended item, doesn't refetch on every sync. */
	private readonly refreshedItemIds = new Set<string>();

	public constructor(
		private readonly page: RecurringV2Page,
		private readonly monarchData: MonarchDataService,
		private readonly manualLoans: ManualLoanUpdates,
		private readonly syncScheduler: SyncScheduler
	) {
		this.panelRow = new PaysTowardPanelRow((itemId, loanAccountId) => void this.manualLoans.link(itemId, loanAccountId));
	}

	/** Syncs again whenever a link or Monarch's data changes. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.manualLoans.changes.value, this.monarchData.snapshot.value];
				this.syncScheduler.request();
			})
		);
	}

	/** Shows the row for an open Monarch expense once Monarch's recurring items and loans load. */
	public sync(): void {
		const itemId = this.page.view ? this.page.openItemId : null;
		if (itemId) void this.monarchData.load();
		const snapshot = itemId ? this.monarchData.snapshot.value : null;
		const flow = snapshot?.recurringFlows.find(candidate => candidate.recurrenceGroup.id === itemId);
		// Monarch's data is fetched once a day, so an item merged or added since is fetched again, with its payments.
		if (itemId && snapshot && !flow && !this.refreshedItemIds.has(itemId)) {
			this.refreshedItemIds.add(itemId);
			void this.monarchData.refresh();
		}
		if (!itemId || !snapshot || flow?.recurrenceGroup.recurringType !== MonarchRecurringType.expense) {
			this.page.removeDetailRow(PAYS_TOWARD_ROW);
			return;
		}

		const loans: LoanChoice[] = snapshot.accounts.filter(account => account.type.name === MonarchAccountType.loan && !account.isHidden).map(account => ({ id: account.id, name: account.displayName }));
		this.panelRow.update({ itemId, loanAccountId: this.manualLoans.loanAccountIdFor(itemId), loans });
		this.page.showDetailRow(PAYS_TOWARD_ROW, this.panelRow);
	}

	public suspend(): void {
		this.page.removeDetailRow(PAYS_TOWARD_ROW);
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeDetailRow(PAYS_TOWARD_ROW);
	}
}
