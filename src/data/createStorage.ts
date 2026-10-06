import { WebLock } from '../common/crossTabLock';
import type { MonarchAccountsClient } from '../monarch/api/monarchAccountsClient';
import type { WingspanData } from './models/wingspanData';
import { WingspanDataService } from './services/wingspanDataService';
import { BrowserLocalStore } from './stores/browserLocalStore';
import { MonarchAccountStore } from './stores/monarchAccountStore';
import type { StorageScope } from './stores/storageScope';
import { SyncedCopyStore } from './stores/syncedCopyStore';
import { UnsavedChangesStore } from './stores/unsavedChangesStore';

const BROWSER_STORE_KEY = 'wingspan';
const SYNCED_COPY_KEY = 'wingspanSynced';
const UNSAVED_CHANGES_KEY = 'wingspanUnsavedChanges';
const DATA_LOCK_KEY = 'wingspanData';

/** Wingspan's data: saved in the household's Monarch account, with a local copy in this browser per household. */
export function createStorage(window: Window, scope: StorageScope, accounts: MonarchAccountsClient, version: string): WingspanDataService {
	return new WingspanDataService(
		new BrowserLocalStore<WingspanData>(() => scope.key(BROWSER_STORE_KEY)),
		new MonarchAccountStore<WingspanData>(accounts),
		new UnsavedChangesStore(() => scope.key(UNSAVED_CHANGES_KEY)),
		new SyncedCopyStore(() => scope.key(SYNCED_COPY_KEY)),
		new WebLock(window.navigator.locks),
		() => scope.key(DATA_LOCK_KEY),
		version
	);
}
