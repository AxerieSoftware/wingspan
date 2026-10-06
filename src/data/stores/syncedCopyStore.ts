import { storage } from 'wxt/utils/storage';

/** The data as this browser and Monarch last agreed on it. */
export interface SyncedCopy {
	/** The Monarch account it was agreed with. It's only a valid base for merges with that account. */
	accountId: string;
	value: unknown;
	/** The ETag Monarch's copy had when they agreed. */
	etag?: string;
}

/** The last version this browser and Monarch agreed on, kept so a merge can tell which side changed what. */
export class SyncedCopyStore {
	public constructor(private readonly key: () => `local:${string}`) {}

	/** Undefined when nothing was saved or it can't be read. */
	public async load(): Promise<SyncedCopy | undefined> {
		const saved = await storage.getItem<unknown>(this.key());
		if (!saved || typeof saved !== 'object' || !('accountId' in saved) || typeof saved.accountId !== 'string' || !('value' in saved)) return undefined;
		const etag = 'etag' in saved && typeof saved.etag === 'string' ? saved.etag : undefined;
		return { accountId: saved.accountId, value: saved.value, etag };
	}

	/** Saved after each successful load or save, when this browser and Monarch are in sync. */
	public async save(syncedCopy: SyncedCopy): Promise<void> {
		await storage.setItem(this.key(), syncedCopy);
	}
}
