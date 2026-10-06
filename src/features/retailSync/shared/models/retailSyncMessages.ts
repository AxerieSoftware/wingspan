/** The stores Wingspan reads purchases from. */
export const RETAILERS = {
	walmart: { name: 'Walmart', origin: 'https://www.walmart.com/*', startUrl: 'https://www.walmart.com/orders', collectorFile: '/retail-walmart-collector.js' },
	costco: { name: 'Costco', origin: 'https://www.costco.com/*', startUrl: 'https://www.costco.com/OrderStatusCmd', collectorFile: '/retail-costco-collector.js' }
} as const;

export type Retailer = keyof typeof RETAILERS;

export const isRetailer = (value: unknown): value is Retailer => typeof value === 'string' && value in RETAILERS;

/** Sent from the Monarch tab to ask the background to read a store's purchases on or after `since`, minus ones already sent. */
export interface RetailSyncRequest {
	type: 'retailSync:start';
	retailer: Retailer;
	knownOrderIds: string[];
	since: string;
}

/** Progress updates the Monarch tab receives during a store's sync: from the background, or `granted` and a denied `failed` from the permission page. */
export type RetailSyncUpdate = { retailer: Retailer } & (
	| { type: 'retailSync:progress'; found: number; fetched: number }
	| { type: 'retailSync:orders'; orders: { order: unknown; isInStore: boolean }[] }
	| { type: 'retailSync:done'; found: number }
	| { type: 'retailSync:failed'; reason: RetailSyncFailure }
	| { type: 'retailSync:awaitingPermission' }
	| { type: 'retailSync:granted' }
);

/** Why a sync stopped: the user is signed out, a bot check, a page Wingspan can't parse, the tab closed or never loaded, an unexpected error, or no permission for the site. */
export type RetailSyncFailure = 'retailerSignedOut' | 'retailerChallenge' | 'retailerFormatChanged' | 'retailerTabClosed' | 'retailerTimedOut' | 'retailerError' | 'retailerPermission';
