import { type ReadonlySignal, signal } from '@preact/signals-core';
import type { Calendar } from '../../../common/calendar';
import { logError } from '../../../common/log';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import { MonarchApiError } from '../../../monarch/api/monarchApiError';
import { type MonarchReceiptsClient, RECEIPTS_PER_UPLOAD, type ReceiptFile } from '../../../monarch/api/monarchReceiptsClient';
import type { ReceiptsPage } from '../../../monarch/pages/transactions/receiptsPage';
import { Layer } from '../../../monarch/ui/components/layer';
import { type RetailSyncResult, RetailSyncResultDialog } from './components/retailSyncResultDialog';
import { ExistingReceiptMatcher } from './models/existingReceiptMatcher';
import { emptyRetailSyncData, type RetailSyncData } from './models/retailSyncData';
import { RETAILERS, type Retailer, type RetailSyncFailure, type RetailSyncRequest, type RetailSyncUpdate } from './models/retailSyncMessages';
import type { RetailSyncState } from './models/retailSyncState';
import type { StoreReceipt } from './models/storeReceipt';
import type { ReceiptPdf } from './services/receiptPdf';
import type { RetailSyncChannel } from './services/retailSyncChannel';

/** How far back the first sync looks. Later syncs start a little before the last sync, to catch orders that finished since. */
const FIRST_SYNC_DAYS = 90;
const OVERLAP_DAYS = 14;

/** The store-specific parts of a sync. */
export interface RetailStore {
	retailer: Retailer;
	/** Converts a purchase from the store's API into a receipt. Null when it can't be parsed. */
	receiptOf(order: unknown, isInStore: boolean): StoreReceipt | null;
	/** The key in Wingspan's data where this store's sync record is stored. */
	dataKey: 'walmartSync' | 'costcoSync';
}

interface PendingReceipt {
	orderId: string;
	file: ReceiptFile;
}

/**
 * Uploads one store's purchases to Monarch as receipts using Monarch's receipt upload. Sent purchases are saved in
 * Wingspan's data so each one is only sent once.
 */
export class RetailSyncSession implements Disposable {
	private readonly syncState = signal<RetailSyncState>({ phase: 'idle' });
	private readonly subscriptions = new DisposableStack();
	private resultLayer: Layer | null = null;
	private uploads: Promise<void> = Promise.resolve();
	private waitingReceipts: PendingReceipt[] = [];
	private readonly queuedOrderIds = new Set<string>();
	private unreadableCount = 0;
	private sentCount = 0;
	/** Receipts already in Monarch before the sync. Purchases that match one are skipped instead of sent again. */
	private existingReceipts = new ExistingReceiptMatcher([]);
	private alreadyInMonarchIds: string[] = [];
	private uploadFailure: string | null = null;
	/** Saved so the sync can be retried once site permission is granted. */
	private request: RetailSyncRequest | null = null;
	/** Holds the request while Wingspan's permission page is open, so the menu isn't blocked in the meantime. */
	private isAwaitingPermission = false;

	public constructor(
		private readonly store: RetailStore,
		private readonly document: Document,
		private readonly page: ReceiptsPage,
		private readonly channel: RetailSyncChannel,
		private readonly dataService: WingspanDataService,
		private readonly receiptsClient: MonarchReceiptsClient,
		private readonly receiptPdf: ReceiptPdf,
		private readonly calendar: Calendar
	) {}

	public get state(): ReadonlySignal<RetailSyncState> {
		return this.syncState;
	}

	public get retailer(): Retailer {
		return this.store.retailer;
	}

	public get displayName(): string {
		return RETAILERS[this.store.retailer].name;
	}

	public listen(): void {
		this.subscriptions.defer(this.channel.listen(this.store.retailer, update => this.onUpdate(update)));
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.resultLayer?.close();
	}

	/** Starts a sync unless one is already running. Purchases Monarch already has a receipt for are skipped. */
	public async sync(): Promise<void> {
		if (this.syncState.peek().phase !== 'idle') return;
		this.isAwaitingPermission = false;
		await this.dataService.load();
		const synced = this.readSyncData();
		const today = this.calendar.today();
		const since = synced.lastSyncedOn ? this.calendar.addDays(synced.lastSyncedOn, -OVERLAP_DAYS) : this.calendar.addDays(today, -FIRST_SYNC_DAYS);
		this.waitingReceipts = [];
		this.queuedOrderIds.clear();
		this.unreadableCount = 0;
		this.sentCount = 0;
		this.alreadyInMonarchIds = [];
		this.uploadFailure = null;
		this.resultLayer?.close();
		this.syncState.value = { phase: 'waiting' };
		try {
			this.existingReceipts = new ExistingReceiptMatcher(await this.receiptsClient.getExistingReceipts(since, today));
		} catch (error) {
			logError(error);
			const reason = error instanceof MonarchApiError ? ` ${error.message}` : '';
			return this.showResult({ outcome: 'failed', message: `Couldn't check which receipts Monarch already has, so nothing was sent.${reason}` });
		}
		this.request = { type: 'retailSync:start', retailer: this.store.retailer, knownOrderIds: synced.uploadedOrderIds, since };
		await this.askBackground(this.request);
	}

	private readSyncData(): RetailSyncData {
		return this.dataService.data.peek()[this.store.dataKey] ?? emptyRetailSyncData();
	}

	private async askBackground(request: RetailSyncRequest): Promise<void> {
		try {
			await this.channel.start(request);
		} catch (error) {
			logError(error);
			this.showResult({ outcome: 'failed', message: `Wingspan couldn't open ${this.displayName}. Reload the page and try again.` });
		}
	}

	private onUpdate(update: RetailSyncUpdate): void {
		switch (update.type) {
			case 'retailSync:awaitingPermission':
				this.isAwaitingPermission = true;
				this.syncState.value = { phase: 'idle' };
				return;
			case 'retailSync:granted':
				if (!this.isAwaitingPermission || !this.request || this.syncState.peek().phase !== 'idle') return;
				this.isAwaitingPermission = false;
				this.syncState.value = { phase: 'waiting' };
				void this.askBackground(this.request);
				return;
			case 'retailSync:progress':
				this.syncState.value = { phase: 'reading', found: update.found, fetched: update.fetched, sent: this.sentCount };
				return;
			case 'retailSync:orders':
				this.queue(update.orders);
				return;
			case 'retailSync:done':
				void this.finish();
				return;
			case 'retailSync:failed':
				this.isAwaitingPermission = false;
				// Purchases already read are still uploaded; the sync just stops there.
				this.uploads = this.uploads.then(() => this.flush()).then(() => this.record(this.alreadyInMonarchIds));
				void this.uploads.then(() => this.showResult({ outcome: 'failed', message: [this.failureMessage(update.reason), this.uploadFailure].filter(Boolean).join(' ') }));
				return;
		}
	}

	private failureMessage(reason: RetailSyncFailure): string {
		const name = this.displayName;
		switch (reason) {
			case 'retailerSignedOut':
				return `Sign in to ${name} in the tab that opened, then sync ${name} again.`;
			case 'retailerChallenge':
				return `${name} asked to check you're not a robot. Finish that in the ${name} tab, then sync ${name} again.`;
			case 'retailerFormatChanged':
				return `${name}'s purchase history changed in a way Wingspan can't read yet. Nothing more was sent.`;
			case 'retailerTabClosed':
				return `The ${name} tab closed before the sync finished. Receipts that were already sent won't be sent again.`;
			case 'retailerTimedOut':
				return `${name} took too long to load. Try again in a moment.`;
			case 'retailerError':
				return `Something went wrong while reading ${name}. Receipts that were already sent won't be sent again.`;
			case 'retailerPermission':
				return `Wingspan needs permission to read ${name}'s site to sync ${name}.`;
		}
	}

	private queue(orders: { order: unknown; isInStore: boolean }[]): void {
		const alreadySent = new Set([...this.readSyncData().uploadedOrderIds, ...this.queuedOrderIds]);
		for (const { order, isInStore } of orders) {
			const receipt = this.store.receiptOf(order, isInStore);
			if (!receipt) {
				this.unreadableCount++;
				continue;
			}
			if (alreadySent.has(receipt.orderId)) continue;
			alreadySent.add(receipt.orderId);
			this.queuedOrderIds.add(receipt.orderId);
			if (this.existingReceipts.claim(receipt)) {
				this.alreadyInMonarchIds.push(receipt.orderId);
				continue;
			}
			this.waitingReceipts.push({ orderId: receipt.orderId, file: { name: this.receiptPdf.fileName(receipt), contentType: 'application/pdf', bytes: this.receiptPdf.render(receipt) } });
		}
		while (this.waitingReceipts.length >= RECEIPTS_PER_UPLOAD) this.enqueueUpload(this.waitingReceipts.splice(0, RECEIPTS_PER_UPLOAD));
	}

	private flush(): Promise<void> {
		const rest = this.waitingReceipts.splice(0);
		return rest.length ? this.upload(rest) : Promise.resolve();
	}

	private enqueueUpload(batch: PendingReceipt[]): void {
		this.uploads = this.uploads.then(() => this.upload(batch));
	}

	/** Each batch is marked as sent as soon as Monarch accepts it, so an interrupted sync never sends it again. */
	private async upload(batch: PendingReceipt[]): Promise<void> {
		if (this.uploadFailure) return;
		// Recorded even if a later batch fails, since Monarch is already processing these, so a retry doesn't resend them.
		let startedCount = 0;
		try {
			await this.receiptsClient.upload(
				batch.map(pending => pending.file),
				() => startedCount++
			);
		} catch (error) {
			logError(error);
			this.uploadFailure = error instanceof MonarchApiError ? `Couldn't send receipts to Monarch. ${error.message}` : "Couldn't send receipts to Monarch.";
		}
		await this.record(batch.slice(0, startedCount).map(pending => pending.orderId));
		this.sentCount += startedCount;
		const current = this.syncState.peek();
		if (current.phase === 'reading') this.syncState.value = { ...current, sent: this.sentCount };
	}

	/** Purchases Monarch now has, whether sent or already there. These are never read again. */
	private async record(orderIds: string[]): Promise<void> {
		if (!orderIds.length) return;
		const { dataKey } = this.store;
		await this.dataService.update(data => {
			const synced = data[dataKey] ?? emptyRetailSyncData();
			return { ...data, [dataKey]: { ...synced, uploadedOrderIds: [...new Set([...synced.uploadedOrderIds, ...orderIds])] } };
		});
	}

	private async finish(): Promise<void> {
		this.uploads = this.uploads.then(() => this.flush());
		await this.uploads;
		const alreadyInMonarch = this.alreadyInMonarchIds.length;
		await this.record(this.alreadyInMonarchIds);
		if (this.uploadFailure) return this.showResult({ outcome: 'failed', message: this.uploadFailure });
		const today = this.calendar.today();
		const { dataKey } = this.store;
		await this.dataService.update(data => ({ ...data, [dataKey]: { ...(data[dataKey] ?? emptyRetailSyncData()), lastSyncedOn: today } }));
		this.showResult({ outcome: 'done', sent: this.sentCount, alreadyInMonarch, unreadable: this.unreadableCount });
	}

	/** Resets the button to idle and shows the sync result in a dialog. */
	private showResult(result: RetailSyncResult): void {
		this.syncState.value = { phase: 'idle' };
		this.sentCount = 0;
		this.unreadableCount = 0;
		this.alreadyInMonarchIds = [];
		this.resultLayer?.close();
		this.resultLayer = new Layer(this.document, close => (
			<RetailSyncResultDialog
				store={this.displayName}
				result={result}
				onViewReceipts={
					this.page.isShowingReceipts
						? undefined
						: () => {
								close();
								this.page.openReceipts();
							}
				}
				onTryAgain={() => {
					close();
					void this.sync();
				}}
				onClose={close}
			/>
		));
	}
}
