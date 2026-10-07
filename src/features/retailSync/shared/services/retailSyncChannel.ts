import { browser } from 'wxt/browser';
import type { Retailer, RetailSyncRequest, RetailSyncUpdate } from '../models/retailSyncMessages';

/** Messaging between the Monarch tab and the extension background for store syncs. */
export interface RetailSyncChannel {
	start(request: RetailSyncRequest): Promise<void>;
	/** Only `retailer`'s updates. Returns the unsubscribe function. */
	listen(retailer: Retailer, onUpdate: (update: RetailSyncUpdate) => void): () => void;
}

export class BrowserRetailSyncChannel implements RetailSyncChannel {
	public async start(request: RetailSyncRequest): Promise<void> {
		await browser.runtime.sendMessage(request);
	}

	public listen(retailer: Retailer, onUpdate: (update: RetailSyncUpdate) => void): () => void {
		const listener = (message: { type?: string; retailer?: string }) => {
			if (typeof message?.type === 'string' && message.type.startsWith('retailSync:') && message.retailer === retailer) onUpdate(message as RetailSyncUpdate);
			return undefined;
		};
		browser.runtime.onMessage.addListener(listener);
		return () => browser.runtime.onMessage.removeListener(listener);
	}
}
