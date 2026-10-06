import { describe, expect, it } from 'vitest';
import { ExistingReceiptMatcher } from './existingReceiptMatcher';
import type { StoreReceipt } from './storeReceipt';

const purchase = (store: string, date: string, total: number): StoreReceipt => ({
	store,
	orderId: `${store}-${date}-${total}`,
	displayId: '1',
	referenceLabel: 'Receipt',
	date,
	isInStore: true,
	items: [],
	subtotal: total,
	adjustments: [],
	tax: 0,
	total,
	savings: 0,
	payments: []
});

describe('finding a purchase Monarch already has a receipt for', () => {
	it('matches the same store, amount to the cent and day, regardless of how Monarch spells the store name', () => {
		const matcher = new ExistingReceiptMatcher([{ merchant: 'COSTCO WHOLESALE', total: 42.5, date: '2026-09-05' }]);

		expect(matcher.claim(purchase('Costco', '2026-09-05', 42.5))).toBe(true);
	});

	it("doesn't match a different day, amount or store", () => {
		const existing = [{ merchant: 'Walmart', total: 42.5, date: '2026-09-05' }];

		expect(new ExistingReceiptMatcher(existing).claim(purchase('Walmart', '2026-09-06', 42.5))).toBe(false);
		expect(new ExistingReceiptMatcher(existing).claim(purchase('Walmart', '2026-09-05', 42.51))).toBe(false);
		expect(new ExistingReceiptMatcher(existing).claim(purchase('Costco', '2026-09-05', 42.5))).toBe(false);
	});

	it("matches each of Monarch's receipts to only one purchase, so a second identical purchase that day is still sent", () => {
		const matcher = new ExistingReceiptMatcher([{ merchant: 'Walmart', total: 9.99, date: '2026-09-05' }]);

		expect(matcher.claim(purchase('Walmart', '2026-09-05', 9.99))).toBe(true);
		expect(matcher.claim(purchase('Walmart', '2026-09-05', 9.99))).toBe(false);
	});
});
