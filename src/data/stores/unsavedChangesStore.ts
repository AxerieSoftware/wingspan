import { storage } from 'wxt/utils/storage';

/** Whether this browser has changes that aren't saved to Monarch yet, persisted across pages so the next sync saves them. */
export class UnsavedChangesStore {
	public constructor(private readonly key: () => `local:${string}`) {}

	/** False when nothing was saved or it can't be read. */
	public async load(): Promise<boolean> {
		const saved = await storage.getItem<unknown>(this.key());
		return typeof saved === 'object' && saved !== null && 'hasUnsavedChanges' in saved && saved.hasUnsavedChanges === true;
	}

	/** Set when a change can't be saved to Monarch, and cleared once a sync saves it. */
	public async save(hasUnsavedChanges: boolean): Promise<void> {
		await storage.setItem(this.key(), { hasUnsavedChanges });
	}
}
