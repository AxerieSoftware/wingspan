import { type ReadonlySignal, signal } from '@preact/signals-core';
import * as v from 'valibot';
import type { CrossTabLock } from '../../common/crossTabLock';
import { logError } from '../../common/log';
import { isSameValue } from '../../common/sameValue';
import { describeIssues } from '../../common/schemaIssues';
import { MonarchApiError } from '../../monarch/api/monarchApiError';
import { EnvelopeVersionMismatchError } from '../errors/envelopeVersionMismatchError';
import { ETagMismatchError } from '../errors/eTagMismatchError';
import { InvalidSavedDataError } from '../errors/invalidSavedDataError';
import { type Envelope, isNewerVersion } from '../models/envelope';
import { CURRENT_SCHEMA_VERSION, emptyWingspanData, hasWingspanData, mergeWingspanData, type WingspanData, WingspanDataSchema } from '../models/wingspanData';
import { BROWSER_SOURCE } from '../stores/browserLocalStore';
import { MONARCH_SOURCE, type MonarchAccountStore } from '../stores/monarchAccountStore';
import type { Store } from '../stores/store';
import type { SyncedCopyStore } from '../stores/syncedCopyStore';
import type { UnsavedChangesStore } from '../stores/unsavedChangesStore';

const MAX_SAVE_ATTEMPTS = 3;

/** `busy` once a load or save is queued, `error` once one fails, until another is queued or the last queued one succeeds. */
export type StorageState = 'idle' | 'busy' | 'error';
type StorageAction = 'load' | 'save';

/** Load/save status, plus the Monarch account Wingspan saves to. */
export interface StorageStatus {
	state: StorageState;
	/** For an error: the full message to show the user. */
	message?: string;
	accountId?: string;
}

/** `accountCreated`: Wingspan just made its hidden account in Monarch. */
export type StorageNoticeKind = 'accountCreated';

/** A one-time notice to the user about where their data is saved. */
export interface StorageNotice {
	kind: StorageNoticeKind;
}

type DataChange = (data: WingspanData) => WingspanData;

/**
 * Saves data in Monarch, with a local browser copy that loads instantly and holds changes that couldn't be saved to
 * Monarch yet. Every operation runs through one queue, so loads and saves never interleave.
 */
export class WingspanDataService {
	private readonly current = signal<WingspanData>(emptyWingspanData());
	private readonly currentStatus = signal<StorageStatus>({ state: 'idle' });
	private readonly latestNotice = signal<StorageNotice | null>(null);
	private readonly hasLoaded = signal(false);
	/** Why the first load failed, while nothing has been read yet. */
	private readonly loadFailure = signal<string | null>(null);
	/** Whether the current operation saved the change to, or read a copy from, this browser before it failed. */
	private hasBrowserCopy = false;
	private hasUnsavedChanges = false;
	private browserEnvelope: Envelope<WingspanData> | undefined;
	private accountEnvelope: Envelope<WingspanData> | undefined;
	private operationQueue: Promise<void> = Promise.resolve();
	private pendingOperationCount = 0;
	private loading: Promise<void> | undefined;

	public constructor(
		private readonly browserStore: Store<WingspanData>,
		private readonly accountStore: MonarchAccountStore<WingspanData>,
		private readonly unsavedChanges: UnsavedChangesStore,
		private readonly syncedCopy: SyncedCopyStore,
		/** Tabs in this browser run one at a time, so none works on a copy another tab is changing. */
		private readonly lock: CrossTabLock,
		private readonly lockName: () => string,
		/** This build's version, saved with its data. */
		private readonly appVersion: string
	) {}

	/** The household's data: this browser's copy at first, then Monarch's once it loads. Changes show up before they're saved. */
	public get data(): ReadonlySignal<WingspanData> {
		return this.current;
	}

	public get status(): ReadonlySignal<StorageStatus> {
		return this.currentStatus;
	}

	public get notice(): ReadonlySignal<StorageNotice | null> {
		return this.latestNotice;
	}

	/** True once real saved data has loaded, from this browser or from Monarch. Until then, only defaults are available. */
	public get isLoaded(): ReadonlySignal<boolean> {
		return this.hasLoaded;
	}

	/** Why the first load failed, null once anything loaded. Later failures show in `status`. */
	public get loadFailureMessage(): ReadonlySignal<string | null> {
		return this.loadFailure;
	}

	/** Loads once. A failed load is retried on the next call. */
	public load(): Promise<void> {
		this.loading ??= this.enqueue('load', async () => {
			if (this.browserEnvelope) {
				this.current.value = this.browserEnvelope.value;
				this.hasLoaded.value = true;
			}
			await this.syncWithMonarch();
		}).then(succeeded => {
			if (succeeded) this.hasLoaded.value = true;
			else this.loading = undefined;
			this.loadFailure.value = succeeded || this.hasLoaded.value ? null : (this.currentStatus.value.message ?? null);
		});
		return this.loading;
	}

	/** Re-reads Monarch and merges in what other browsers saved. Before the first load, this does the first load. */
	public async refresh(): Promise<void> {
		// Before the first load finishes, that load counts as the fresh read.
		if (!this.hasLoaded.value) return this.load();
		await this.enqueue('load', () => this.syncWithMonarch());
	}

	/** Shows the change immediately, then saves it. If it can't be saved to Monarch, it's kept in this browser and marked unsaved, so the next sync saves it to Monarch. */
	public async update(change: DataChange): Promise<void> {
		void this.load();
		this.current.value = change(this.current.value);
		await this.enqueue('save', async () => {
			try {
				await this.saveInMonarch(change);
			} catch (error) {
				await this.saveInBrowser(change);
				await this.setUnsavedChanges(true);
				throw error;
			}
		});
	}

	/**
	 * Every operation holds this browser's lock and starts from its latest copy, since another tab may have saved a
	 * change after this tab last read it. Never rejects; resolves to whether the operation succeeded.
	 */
	private enqueue(action: StorageAction, operation: () => Promise<void>): Promise<boolean> {
		this.pendingOperationCount += 1;
		this.setStatus('busy');

		const run = this.operationQueue
			.then(() =>
				this.lock.run(this.lockName(), async () => {
					this.hasBrowserCopy = false;
					this.hasUnsavedChanges = await this.unsavedChanges.load();
					this.browserEnvelope = this.validated(await this.browserStore.load(), BROWSER_SOURCE);
					// A load counts if it showed this browser's copy. A save counts only if the change itself was saved to this browser.
					this.hasBrowserCopy = action === 'load' && this.browserEnvelope !== undefined;
					await operation();
				})
			)
			.then(
				() => this.finishOperation(),
				(error: unknown) => this.failOperation(action, error)
			);
		this.operationQueue = run.then(() => undefined);
		return run;
	}

	private finishOperation(): boolean {
		this.pendingOperationCount -= 1;
		if (this.pendingOperationCount === 0) this.setStatus('idle');
		return true;
	}

	private failOperation(action: StorageAction, error: unknown): boolean {
		this.pendingOperationCount -= 1;
		this.currentStatus.value = { ...this.statusNow('error'), message: this.failureMessage(action, error) };
		return false;
	}

	/** What happened, why, and where that leaves the user's data, in plain language. */
	private failureMessage(action: StorageAction, error: unknown): string {
		const reason = this.failureReason(error);
		if (action === 'save') {
			return this.hasBrowserCopy
				? `Couldn't save to Monarch. ${reason} Your change is saved in this browser and will be saved to Monarch once it's reachable.`
				: `Couldn't save your change. ${reason} It isn't saved anywhere yet.`;
		}
		return this.hasBrowserCopy ? `Couldn't load from Monarch. ${reason} Showing what's saved in this browser.` : `Couldn't load Wingspan's data. ${reason}`;
	}

	private failureReason(error: unknown): string {
		if (error instanceof MonarchApiError) return error.message;
		if (error instanceof ETagMismatchError) return 'Another browser was saving at the same time.';
		if (error instanceof EnvelopeVersionMismatchError) return "A newer version of Wingspan saved your data, and this one won't change it. Update Wingspan to the latest version, then reload the page.";
		if (error instanceof InvalidSavedDataError) {
			logError(error);
			return `Wingspan can't read what it saved ${error.source === MONARCH_SOURCE ? 'in Monarch' : 'in this browser'}, so it's leaving it as is. Report a problem from Settings so it can be fixed.`;
		}
		logError(error);
		return 'Something unexpected went wrong.';
	}

	private async loadAccount(): Promise<Envelope<WingspanData> | undefined> {
		return this.validated(await this.accountStore.load(), MONARCH_SOURCE);
	}

	/** If another browser saved at the same time, re-read Monarch and merge on top of what it saved. */
	private async syncWithMonarch(): Promise<void> {
		let monarchEnvelope = await this.loadAccount();
		for (let attempt = 1; ; attempt++) {
			try {
				return await this.syncWithAccount(monarchEnvelope);
			} catch (error) {
				if (!(error instanceof ETagMismatchError) || attempt >= MAX_SAVE_ATTEMPTS) throw error;
				monarchEnvelope = await this.loadAccount();
			}
		}
	}

	private async syncWithAccount(monarchEnvelope: Envelope<WingspanData> | undefined): Promise<void> {
		const browserData = this.browserEnvelope?.value ?? emptyWingspanData();
		if (!monarchEnvelope) {
			this.accountEnvelope = undefined;
			// Nothing in Monarch yet, so this browser's copy (if any) is all there is.
			if (hasWingspanData(browserData)) await this.storeInMonarch(browserData, undefined);
			return;
		}
		// Unchanged since this browser last read or wrote it, so there's nothing to show or save.
		if (monarchEnvelope.etag === this.accountEnvelope?.etag && !this.hasUnsavedChanges) return;

		this.accountEnvelope = monarchEnvelope;
		const base = await this.syncedBase();
		// A browser new to this account merges in its own copy, same as one with unsaved changes.
		const merged = this.hasUnsavedChanges || !base ? mergeWingspanData(monarchEnvelope.value, browserData, base) : undefined;
		// Nothing to add from this browser, so skip the write; it would only make every other browser re-read it.
		if (merged && !isSameValue(merged, monarchEnvelope.value)) return this.storeInMonarch(merged, monarchEnvelope);

		this.current.value = monarchEnvelope.value;
		await this.saveInBrowser(() => monarchEnvelope.value);
		await this.saveSyncedCopy(monarchEnvelope.value, monarchEnvelope.etag);
		if (this.hasUnsavedChanges) await this.setUnsavedChanges(false);
	}

	private async saveInMonarch(change: DataChange): Promise<void> {
		if (this.hasUnsavedChanges) await this.syncWithMonarch();

		// If another tab in this browser saved since, the synced copy has moved ahead, so this page's copy is stale and gets re-read.
		const syncedETag = (await this.syncedCopy.load())?.etag;
		let baseEnvelope = this.accountEnvelope && this.accountEnvelope.etag === syncedETag ? this.accountEnvelope : await this.loadAccount();
		for (let attempt = 1; ; attempt++) {
			// Before the account exists, this browser's copy is the latest data.
			const baseData = baseEnvelope?.value ?? this.browserEnvelope?.value ?? emptyWingspanData();
			try {
				return await this.storeInMonarch(change(baseData), baseEnvelope);
			} catch (error) {
				if (!(error instanceof ETagMismatchError) || attempt >= MAX_SAVE_ATTEMPTS) throw error;
				baseEnvelope = await this.loadAccount();
			}
		}
	}

	private async storeInMonarch(data: WingspanData, baseEnvelope: Envelope<WingspanData> | undefined): Promise<void> {
		const isCreatingAccount = !this.accountStore.linkedAccountId;
		this.accountEnvelope = await this.accountStore.store({ version: CURRENT_SCHEMA_VERSION, wingspanVersion: this.appVersion, etag: baseEnvelope?.etag ?? '', value: data });
		this.current.value = data;
		await this.saveInBrowser(() => data);
		await this.saveSyncedCopy(data, this.accountEnvelope.etag);
		if (this.hasUnsavedChanges) await this.setUnsavedChanges(false);
		if (isCreatingAccount) this.latestNotice.value = { kind: 'accountCreated' };
	}

	/** Applies the change to this browser's latest copy, so another tab's save isn't lost. */
	private async saveInBrowser(change: DataChange): Promise<void> {
		for (let attempt = 1; ; attempt++) {
			const changedData = change(this.browserEnvelope?.value ?? emptyWingspanData());
			try {
				this.browserEnvelope = await this.browserStore.store({ version: CURRENT_SCHEMA_VERSION, wingspanVersion: this.appVersion, etag: this.browserEnvelope?.etag ?? '', value: changedData });
				this.current.value = changedData;
				this.hasBrowserCopy = true;
				return;
			} catch (error) {
				if (!(error instanceof ETagMismatchError) || attempt >= MAX_SAVE_ATTEMPTS) throw error;
				this.browserEnvelope = this.validated(await this.browserStore.load(), BROWSER_SOURCE);
			}
		}
	}

	/** The last version this browser and its account agreed on. A copy from a different account, or one that can't be read, isn't a valid base. */
	private async syncedBase(): Promise<WingspanData | undefined> {
		const syncedCopy = await this.syncedCopy.load();
		const accountId = this.accountStore.linkedAccountId;
		if (!syncedCopy || !accountId || syncedCopy.accountId !== accountId) return undefined;
		const result = v.safeParse(WingspanDataSchema, syncedCopy.value);
		return result.success ? result.output : undefined;
	}

	private async saveSyncedCopy(data: WingspanData, etag: string): Promise<void> {
		const accountId = this.accountStore.linkedAccountId;
		if (accountId) await this.syncedCopy.save({ accountId, value: data, etag });
	}

	private async setUnsavedChanges(hasUnsavedChanges: boolean): Promise<void> {
		this.hasUnsavedChanges = hasUnsavedChanges;
		await this.unsavedChanges.save(hasUnsavedChanges);
	}

	private validated(envelope: Envelope<WingspanData> | undefined, source: string): Envelope<WingspanData> | undefined {
		if (!envelope) return undefined;
		if (envelope.version > CURRENT_SCHEMA_VERSION) throw new EnvelopeVersionMismatchError(envelope.version, CURRENT_SCHEMA_VERSION);

		const result = v.safeParse(WingspanDataSchema, envelope.value);
		// A newer version may have saved values this one doesn't know, like a new setting option. Updating fixes that.
		if (!result.success && isNewerVersion(envelope.wingspanVersion, this.appVersion)) throw new EnvelopeVersionMismatchError(envelope.version, CURRENT_SCHEMA_VERSION);
		if (!result.success) throw new InvalidSavedDataError(source, describeIssues(result.issues));
		return { ...envelope, value: result.output };
	}

	private setStatus(state: StorageState): void {
		this.currentStatus.value = this.statusNow(state);
	}

	private statusNow(state: StorageState): StorageStatus {
		return { state, accountId: this.accountStore.linkedAccountId };
	}
}
