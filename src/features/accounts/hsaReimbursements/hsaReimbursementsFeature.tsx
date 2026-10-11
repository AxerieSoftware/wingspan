import { effect, untracked } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { QueryResult, SyncedQueries } from '../../../common/syncedQueries';
import type { MonarchDataService } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { TaggedTransaction, TransactionTag } from '../../../monarch/api/models/taggedTransaction';
import type { MonarchTransactionsClient } from '../../../monarch/api/monarchTransactionsClient';
import type { AccountDetailsPage } from '../../../monarch/pages/accounts/accountDetailsPage';
import { Island } from '../../../monarch/ui/components/island';
import { Layer } from '../../../monarch/ui/components/layer';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import { HsaReimbursementsCard, type HsaReimbursementsView } from './components/hsaReimbursementsCard';
import { HsaTagsDialog } from './components/hsaTagsDialog';
import { toHsaExpenses } from './models/hsaExpenses';
import { type HsaReimbursementTags, resolveHsaReimbursementTags } from './models/hsaReimbursementTags';

/** Monarch's subtype for a health savings account. */
const HSA_SUBTYPE = 'health_savings_account';
const TAGS_QUERY = 'monarchTransactionTags';
const TAGGED_TRANSACTIONS_QUERY = 'monarchTaggedTransactions';

/** On an HSA's account page, the expenses tagged to pay back from it, so the household knows what it can still withdraw. */
export class HsaReimbursementsFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private cardIsland: Island | null = null;
	private shownAccountId: string | null = null;
	private dialogLayer: Layer | null = null;

	public constructor(
		private readonly window: Window,
		private readonly page: AccountDetailsPage,
		private readonly monarchData: MonarchDataService,
		private readonly dataService: WingspanDataService,
		private readonly transactionsClient: MonarchTransactionsClient,
		private readonly syncedQueries: SyncedQueries,
		private readonly queryClient: QueryClient,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				// The account's subtype comes with Monarch's snapshot, and the chosen tags with Wingspan's data.
				void [this.monarchData.snapshot.value, this.dataService.data.value];
				untracked(() => this.sync());
			})
		);
	}

	/** Shows the card on an HSA's page, re-reading tags on each visit since they're changed on other pages. */
	public sync(): void {
		const accountId = this.page.accountId;
		if (!accountId) {
			this.hideCard();
			return;
		}

		void this.monarchData.load();
		const account = this.monarchData.snapshot.peek()?.accounts.find(candidate => candidate.id === accountId);
		if (account?.subtype?.name !== HSA_SUBTYPE) {
			this.hideCard();
			return;
		}

		if (this.shownAccountId !== accountId) {
			this.shownAccountId = accountId;
			void this.queryClient.invalidateQueries({ queryKey: [TAGS_QUERY] });
			void this.queryClient.invalidateQueries({ queryKey: [TAGGED_TRANSACTIONS_QUERY] });
		}
		this.page.showCard({ render: cardEl => this.mountCard(cardEl) });
		this.renderCard();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.dialogLayer?.close();
		this.hideCard();
	}

	private hideCard(): void {
		this.shownAccountId = null;
		this.page.removeCard();
	}

	private mountCard(cardEl: HTMLElement): () => void {
		this.cardIsland = new Island(cardEl);
		this.renderCard();
		return () => {
			this.cardIsland?.unmount();
			this.cardIsland = null;
		};
	}

	private renderCard(): void {
		if (!this.cardIsland) return;
		this.cardIsland.render(
			<HsaReimbursementsCard
				view={this.readView()}
				formatter={this.formatter}
				transactionHref={transactionId => `/transactions/${transactionId}`}
				onOpenTransaction={transactionId => this.page.openTransaction(transactionId)}
				onChooseTags={() => this.openTagsDialog()}
				onRetry={() => this.retry()}
			/>
		);
	}

	private readView(): HsaReimbursementsView {
		const tagsResult = this.readTags();
		if (tagsResult.status !== 'ready') return tagsResult;

		const tags = resolveHsaReimbursementTags(this.dataService.data.peek().hsaReimbursementTags, tagsResult.data);
		const toReimburseTag = tagsResult.data.find(tag => tag.id === tags.toReimburseTagId);
		if (!toReimburseTag) return { status: 'noTag' };

		const results = [tags.toReimburseTagId, tags.reimbursedTagId].filter(tagId => tagId !== '').map(tagId => this.readTaggedTransactions(tagId));
		if (results.some(result => result.status === 'failed')) return { status: 'failed' };
		const transactions = results.flatMap(result => (result.status === 'ready' ? [result.data] : []));
		if (transactions.length < results.length) return { status: 'loading' };

		return { status: 'ready', expenses: toHsaExpenses(transactions.flat(), tags), toReimburseTagName: toReimburseTag.name, hasReimbursedTag: tags.reimbursedTagId !== '' };
	}

	private readTags(): QueryResult<TransactionTag[]> {
		return this.syncedQueries.read([TAGS_QUERY], () => this.transactionsClient.getTransactionTags());
	}

	private readTaggedTransactions(tagId: string): QueryResult<TaggedTransaction[]> {
		return this.syncedQueries.read([TAGGED_TRANSACTIONS_QUERY, tagId], () => this.transactionsClient.getTaggedTransactions(tagId));
	}

	private openTagsDialog(): void {
		const tagsResult = this.readTags();
		if (tagsResult.status !== 'ready') return;

		const initialTags = resolveHsaReimbursementTags(this.dataService.data.peek().hsaReimbursementTags, tagsResult.data);
		this.dialogLayer?.close();
		this.dialogLayer = new Layer(this.window.document, close => <HsaTagsDialog tags={tagsResult.data} initialTags={initialTags} onSave={chosenTags => this.saveTags(chosenTags)} onClose={close} />);
	}

	private saveTags(chosenTags: HsaReimbursementTags): Promise<void> {
		return this.dataService.update(data => ({ ...data, hsaReimbursementTags: chosenTags }));
	}

	private retry(): void {
		this.syncedQueries.forgetFailures();
		this.renderCard();
	}
}
