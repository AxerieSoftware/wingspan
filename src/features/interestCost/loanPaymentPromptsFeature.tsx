import { effect } from '@preact/signals-core';
import { countOf } from '../../common/countOf';
import type { SyncScheduler } from '../../common/syncScheduler';
import type { MonarchDataService, MonarchSnapshot } from '../../data/services/monarchDataService';
import type { Account } from '../../monarch/api/models/account';
import { MonarchAccountType } from '../../monarch/api/models/monarchValues';
import type { AccountsPage } from '../../monarch/pages/accounts/accountsPage';
import type { SlotContent } from '../../monarch/pages/mountedSlot';
import type { SidebarPage } from '../../monarch/pages/sidebar/sidebarPage';
import type { TransactionDrawer } from '../../monarch/pages/transactions/transactionDrawer';
import { Banner } from '../../monarch/ui/components/banner';
import { Button } from '../../monarch/ui/components/button';
import { InfoIcon } from '../../monarch/ui/components/icons';
import { Island } from '../../monarch/ui/components/island';
import type { Formatter } from '../../monarch/ui/formatter';
import { SidebarCountBadge } from '../sidebar/sidebarCountBadge';
import type { WingspanFeature } from '../wingspanFeature';
import { WingspanMark } from '../wingspanMark';
import type { ManualLoanUpdates } from './services/manualLoanUpdates';

/** A manual loan whose balance was entered before a payment linked to it posted. */
interface StaleLoan {
	account: Account;
	enteredDate: string;
	estimate: number;
}

const ACCOUNTS_PATH = '/accounts';

/**
 * Prompts to update a manual loan's balance once a payment linked to it posts: a banner in the payment's transaction
 * details, a note on the loan's row on Accounts and a count on Accounts in the sidebar. All go away once a newer
 * balance is entered.
 */
export class LoanPaymentPromptsFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private readonly accountsBadge: SidebarCountBadge;
	private bannerIsland: Island | null = null;
	private renderedBannerKey = '';
	/** Sync runs on every change to the page, so the stale loans are worked out again only when Monarch's data, a link or an entered balance changes. */
	private staleLoans: { snapshot: MonarchSnapshot; changes: unknown; byAccountId: ReadonlyMap<string, StaleLoan> } | null = null;

	public constructor(
		private readonly drawer: TransactionDrawer,
		private readonly accountsPage: AccountsPage,
		sidebar: SidebarPage,
		private readonly monarchData: MonarchDataService,
		private readonly manualLoans: ManualLoanUpdates,
		private readonly syncScheduler: SyncScheduler,
		private readonly formatter: Formatter
	) {
		this.accountsBadge = new SidebarCountBadge(sidebar, ACCOUNTS_PATH);
	}

	/** Syncs again whenever Monarch's data, an entered balance or a link changes. */
	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.monarchData.snapshot.value, this.manualLoans.changes.value];
				this.syncScheduler.request();
			})
		);
	}

	/** Needs Monarch's data only once a payment is linked, since there's nothing to prompt for before. */
	public sync(): void {
		const isNeeded = this.manualLoans.hasAnyLinkedPayment();
		if (isNeeded) void this.monarchData.load();
		const snapshot = isNeeded ? this.monarchData.snapshot.value : null;
		const staleLoans = snapshot ? this.staleLoansIn(snapshot) : new Map<string, StaleLoan>();
		this.syncBanner(snapshot, staleLoans);
		this.accountsBadge.show(staleLoans.size, `${countOf(staleLoans.size, 'loan balance')} to update`);
		this.syncAccountNotes(staleLoans);
	}

	public suspend(): void {
		this.clear();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.clear();
	}

	/** The manual loans with a linked payment posted since their balance was entered, by account id. A loan drops out until its entered balance loads. */
	private staleLoansIn(snapshot: MonarchSnapshot): ReadonlyMap<string, StaleLoan> {
		const changes = this.manualLoans.changes.peek();
		if (this.staleLoans?.snapshot === snapshot && this.staleLoans.changes === changes) return this.staleLoans.byAccountId;

		const byAccountId = new Map<string, StaleLoan>();
		for (const account of snapshot.accounts) {
			if (account.type.name !== MonarchAccountType.loan || !account.isManual || !this.manualLoans.hasLinkedPayment(account.id)) continue;
			const view = this.manualLoans.view(account, snapshot);
			if (view.status === 'ready' && view.paymentsSince.length > 0) byAccountId.set(account.id, { account, enteredDate: view.entered.date, estimate: view.estimate });
		}
		// Asking for a balance not yet loaded starts loading it, which changes `changes`, so this is cached under the value it ends up with.
		this.staleLoans = { snapshot, changes: this.manualLoans.changes.peek(), byAccountId };
		return byAccountId;
	}

	private syncBanner(snapshot: MonarchSnapshot | null, staleLoans: ReadonlyMap<string, StaleLoan>): void {
		const transactionId = this.drawer.transactionId;
		const transaction = transactionId && staleLoans.size ? snapshot?.transactions.find(candidate => candidate.id === transactionId) : undefined;
		const loanAccountId = transaction && !transaction.pending ? this.manualLoans.loanAccountIdFor(transaction.recurrenceGroupId) : undefined;
		const staleLoan = loanAccountId ? staleLoans.get(loanAccountId) : undefined;
		if (!transaction || !staleLoan || transaction.date <= staleLoan.enteredDate) {
			this.drawer.removeBanner();
			return;
		}

		this.drawer.showBanner({ render: bannerEl => this.mountBanner(bannerEl) });
		const { account, enteredDate, estimate } = staleLoan;
		const bannerKey = `${account.id}|${account.displayName}|${enteredDate}|${estimate}`;
		if (bannerKey === this.renderedBannerKey) return;

		this.renderedBannerKey = bannerKey;
		this.bannerIsland?.render(
			<Banner actions={<Button onClick={() => this.manualLoans.openUpdateDialog(account.id, account.displayName, estimate)}>Update balance</Button>}>
				{`This payment goes toward ${account.displayName}, whose balance was last entered ${this.formatter.longDate(enteredDate)}. `}
				<WingspanMark />
			</Banner>
		);
	}

	private mountBanner(bannerEl: HTMLElement): () => void {
		this.bannerIsland = new Island(bannerEl);
		this.renderedBannerKey = '';
		return () => {
			this.bannerIsland?.unmount();
			this.bannerIsland = null;
		};
	}

	private syncAccountNotes(staleLoans: ReadonlyMap<string, StaleLoan>): void {
		const notes = new Map<string, SlotContent>(this.accountsPage.isActive ? [...staleLoans.keys()].map(accountId => [accountId, { render: noteEl => this.renderAccountNote(noteEl) }]) : []);
		this.accountsPage.showAccountNotes(notes);
	}

	/** Like Monarch's "Account disconnected", but in its info color: an icon and the note, then a separator before the account's type. */
	private renderAccountNote(noteEl: HTMLElement): () => void {
		const island = new Island(noteEl);
		island.render(
			<>
				<span className="mb-2xs flex items-center gap-2xs text-sm leading-[150%] text-content-info">
					<InfoIcon size={14} />
					<span className="text-sm leading-[normal] font-book text-content-info">Payment posted, update balance</span>
					<WingspanMark />
				</span>
				<div role="separator" aria-orientation="vertical" data-mds="separator" className="h-4 w-px shrink-0 self-center rounded-full bg-divider-secondary" />
			</>
		);
		return () => island.unmount();
	}

	private clear(): void {
		this.drawer.removeBanner();
		this.accountsPage.removeAccountNotes();
		this.accountsBadge.remove();
	}
}
