import type { RetailSyncFailure } from '../models/retailSyncMessages';

/** The fields Wingspan needs from one purchase in a store's order list. */
export interface ListedOrder {
	id: string;
	isInStore: boolean;
}

export type PrepareResult = { status: 'ok'; orders: ListedOrder[] } | { status: 'failed'; reason: RetailSyncFailure };

/** Reads a store's purchases from the store's page. The background calls it in steps so it can report progress. */
export interface RetailCollector {
	/** The purchases on or after `since` that aren't in `knownOrderIds`, newest first. */
	prepare(since: string, knownOrderIds: string[]): Promise<PrepareResult>;
	/** Each purchase, trimmed to what a receipt needs, or null when the store didn't return one. `alreadyRead` and `total` count across the whole sync, for progress. */
	fetchOrders(orders: ListedOrder[], alreadyRead?: number, total?: number): Promise<{ order: unknown; isInStore: boolean }[] | null>;
	/** Removes the overlay so the user can deal with whatever stopped the sync. */
	hideOverlay(): void;
}

/** Where each collector registers itself on the store's page so the background can call it. */
export type CollectorWindow = Window & { __wingspanRetail?: Partial<Record<string, RetailCollector>> };
