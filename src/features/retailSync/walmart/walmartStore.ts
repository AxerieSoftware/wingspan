import * as v from 'valibot';
import type { RetailStore } from '../shared/retailSyncSession';
import { receiptFromOrder, WalmartOrderSchema } from './models/walmartReceipt';

/** Walmart: online and in-store orders, synced as receipts. */
export const walmartStore: RetailStore = {
	retailer: 'walmart',
	receiptOf: (order, isInStore) => {
		const parsed = v.safeParse(WalmartOrderSchema, order);
		return parsed.success ? receiptFromOrder(parsed.output, isInStore) : null;
	},
	dataKey: 'walmartSync'
};
