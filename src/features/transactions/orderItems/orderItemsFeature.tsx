import { batch, effect, signal, untracked } from '@preact/signals-core';
import { CENTS_PER_DOLLAR, toCents } from '../../../common/money';
import type { SyncedQueries } from '../../../common/syncedQueries';
import type { SplitTransaction, TransactionSplitInput } from '../../../monarch/api/models/splitTransaction';
import type { TransactionCategory } from '../../../monarch/api/models/transaction';
import { MonarchApiError } from '../../../monarch/api/monarchApiError';
import type { MonarchSplitsClient } from '../../../monarch/api/monarchSplitsClient';
import type { TransactionDrawer } from '../../../monarch/pages/transactions/transactionDrawer';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { WingspanFeature } from '../../wingspanFeature';
import { OrderItemsCard, type SaveStatus } from './components/orderItemsCard';
import { categoriesOfItems, NOT_IN_CHARGE, planItemSplits } from './models/itemSplits';
import { notesFor, type OrderNotes, parseOrderNotes } from './models/orderNotes';

const SPLIT_TRANSACTION_QUERY = 'monarchSplitTransaction';
const CATEGORIES_QUERY = 'monarchCategories';
/** An order with one item has nothing to sort. */
const MIN_ITEMS = 2;

/** An order's items and where each sits now. */
interface OrderView {
	transaction: SplitTransaction;
	order: OrderNotes;
	/** Each item's category in its split now. */
	currentCategoryIds: string[];
}

/**
 * Items in this order, in the details of a transaction split from a synced order: each item of the order's notes with
 * a category, saved as one split per category, with the charge shared out by price like Monarch's retail sync does.
 */
export class OrderItemsFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	/** Categories picked for items, by their place in the order, for the order shown. */
	private readonly chosenCategoryIds = signal<ReadonlyMap<number, string>>(new Map());
	private readonly saveStatus = signal<SaveStatus>({ status: 'idle' });
	private shownTransactionId: string | null = null;
	private parsed: { transaction: SplitTransaction; view: OrderView | null } | null = null;
	private island: Island | null = null;
	private renderedInputs: unknown[] | null = null;

	public constructor(
		private readonly window: Window,
		private readonly drawer: TransactionDrawer,
		private readonly splitsClient: MonarchSplitsClient,
		private readonly syncedQueries: SyncedQueries,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [this.chosenCategoryIds.value, this.saveStatus.value];
				untracked(() => this.sync());
			})
		);
	}

	public sync(): void {
		const transactionId = this.drawer.transactionId;
		if (transactionId !== this.shownTransactionId) {
			this.shownTransactionId = transactionId;
			batch(() => {
				this.chosenCategoryIds.value = new Map();
				this.saveStatus.value = { status: 'idle' };
			});
		}
		const view = transactionId ? this.viewOf(transactionId) : null;
		const categories = view ? this.syncedQueries.read([CATEGORIES_QUERY], () => this.splitsClient.getCategories()) : null;
		if (!view || categories?.status !== 'ready') {
			this.drawer.removeItems();
			return;
		}

		this.drawer.showItems({ render: itemsEl => this.mount(itemsEl) });
		this.render(view, categories.data);
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.drawer.removeItems();
	}

	/** The order behind the transaction, or null when it isn't split from a synced order with items to sort. Parsed once per fetch. */
	private viewOf(transactionId: string): OrderView | null {
		const result = this.syncedQueries.read([SPLIT_TRANSACTION_QUERY, transactionId], () => this.splitsClient.getSplitTransaction(transactionId));
		const transaction = result.status === 'ready' ? result.data : null;
		if (!transaction) return null;
		if (this.parsed?.transaction === transaction) return this.parsed.view;

		const order = parseOrderNotes(transaction.notes);
		const splits = transaction.splits.map(split => ({ categoryId: split.categoryId, itemLines: parseOrderNotes(split.notes).items.map(item => item.line) }));
		const view = order.items.length < MIN_ITEMS ? null : { transaction, order, currentCategoryIds: categoriesOfItems(order.items, splits) };
		this.parsed = { transaction, view };
		return view;
	}

	private mount(itemsEl: HTMLElement): () => void {
		this.island = new Island(itemsEl);
		this.renderedInputs = null;
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}

	/** Renders only when something shown changed, since every change to Monarch's page syncs. */
	private render(view: OrderView, categories: TransactionCategory[]): void {
		if (!this.island) return;
		const inputs = [view.transaction, categories, this.chosenCategoryIds.peek(), this.saveStatus.peek()];
		if (this.renderedInputs?.every((input, index) => input === inputs[index])) return;
		this.renderedInputs = inputs;

		const categoryIds = this.categoryIdsOf(view);
		this.island.render(
			<OrderItemsCard
				items={view.order.items}
				categoryIds={categoryIds}
				categories={categories}
				splitCount={new Set(categoryIds.filter(categoryId => categoryId !== NOT_IN_CHARGE)).size}
				isChanged={categoryIds.some((categoryId, index) => categoryId !== view.currentCategoryIds[index])}
				saveStatus={this.saveStatus.peek()}
				formatter={this.formatter}
				onChangeCategory={(itemIndex, categoryId) => this.chooseCategory(itemIndex, categoryId)}
				onRemove={itemIndex => this.chooseCategory(itemIndex, NOT_IN_CHARGE)}
				onAddBack={itemIndex => this.chooseCategory(itemIndex, this.addBackCategoryOf(view, itemIndex))}
				onReset={() => {
					this.chosenCategoryIds.value = new Map();
					this.saveStatus.value = { status: 'idle' };
				}}
				onSave={() => void this.save(view)}
			/>
		);
	}

	private chooseCategory(itemIndex: number, categoryId: string): void {
		this.chosenCategoryIds.value = new Map(this.chosenCategoryIds.peek()).set(itemIndex, categoryId);
	}

	/** Back in the split it was in, or in the first split when it was taken out before. */
	private addBackCategoryOf(view: OrderView, itemIndex: number): string {
		const currentCategoryId = view.currentCategoryIds[itemIndex] ?? NOT_IN_CHARGE;
		return currentCategoryId === NOT_IN_CHARGE ? (view.transaction.splits[0]?.categoryId ?? NOT_IN_CHARGE) : currentCategoryId;
	}

	private categoryIdsOf(view: OrderView): string[] {
		const chosen = this.chosenCategoryIds.peek();
		return view.currentCategoryIds.map((categoryId, index) => chosen.get(index) ?? categoryId);
	}

	/**
	 * Saves one split per category, keeping each kept category's split and what it carries, like tags and review, and
	 * copying them from the first split for a new one. Monarch's page shows the old splits until it reloads.
	 */
	private async save(view: OrderView): Promise<void> {
		if (this.saveStatus.peek().status === 'saving') return;
		const { transaction, order } = view;
		const sign = Math.sign(transaction.amount) || 1;
		const planned = planItemSplits(
			Math.abs(toCents(transaction.amount)),
			order.items,
			this.categoryIdsOf(view),
			transaction.splits.map(split => split.categoryId)
		);
		const unusedSplits = [...transaction.splits];
		const inputs = planned.flatMap((split): TransactionSplitInput[] => {
			const keptIndex = unusedSplits.findIndex(candidate => candidate.categoryId === split.categoryId);
			const kept = keptIndex === -1 ? undefined : unusedSplits.splice(keptIndex, 1)[0];
			const template = kept ?? transaction.splits[0];
			if (!template) return [];
			const { id: _id, ...carried } = template;
			return [{ ...carried, ...(kept ? { id: kept.id } : {}), categoryId: split.categoryId, amount: (sign * split.amountCents) / CENTS_PER_DOLLAR, notes: notesFor(split.items, order) }];
		});

		this.saveStatus.value = { status: 'saving' };
		let saved: { id: string; categoryId: string }[];
		try {
			saved = await this.splitsClient.replaceSplits(transaction.id, inputs);
		} catch (error) {
			this.saveStatus.value = { status: 'failed', message: error instanceof MonarchApiError ? error.message : "Monarch didn't save the splits." };
			return;
		}
		this.reopen(view, saved);
	}

	/** Reopens the split that has the category this one had, or the first, so Monarch's page shows the new splits. */
	private reopen(view: OrderView, saved: { id: string; categoryId: string }[]): void {
		const openCategoryId = view.transaction.splits.find(split => split.id === this.shownTransactionId)?.categoryId;
		const splitId = (saved.find(split => split.categoryId === openCategoryId) ?? saved[0])?.id ?? view.transaction.id;
		const { location } = this.window;
		if (location.pathname === `/transactions/${splitId}`) location.reload();
		else location.assign(`/transactions/${splitId}${location.search}`);
	}
}
