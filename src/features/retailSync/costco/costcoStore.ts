import * as v from 'valibot';
import type { RetailStore } from '../shared/retailSyncSession';
import { CostcoReceiptSchema, receiptFromCostco } from './models/costcoReceipt';

/** Costco: warehouse and gas station receipts. Returns are skipped. */
export const costcoStore: RetailStore = {
	retailer: 'costco',
	receiptOf: order => {
		const parsed = v.safeParse(CostcoReceiptSchema, order);
		return parsed.success ? receiptFromCostco(parsed.output) : null;
	},
	dataKey: 'costcoSync'
};
