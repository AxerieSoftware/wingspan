import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CostcoReceiptSchema, receiptFromCostco } from './costcoReceipt';

const receipt = (overrides: Record<string, unknown> = {}) =>
	v.parse(CostcoReceiptSchema, {
		transactionBarcode: '21134300800232509051234',
		transactionDateTime: '2026-09-05T14:22:00',
		transactionType: 'Sales',
		warehouseName: 'Springfield',
		subTotal: 40.47,
		taxes: 2.03,
		total: 42.5,
		itemArray: [
			{ itemDescription01: 'KS PAPER TOWEL', itemDescription02: '12 ROLLS', unit: 1, amount: 22.99 },
			{ itemDescription01: '/1234567', unit: -1, amount: -4.5 },
			{ itemDescription01: 'ROTISSERIE CHICKEN', unit: 2, amount: 21.98 }
		],
		tenderArray: [{ tenderDescription: 'VISA', amountTender: 42.5 }],
		...overrides
	});

describe('a Costco receipt for Monarch', () => {
	it('lists each item, with instant savings as separate lines, and adds up to what was charged', () => {
		const result = receiptFromCostco(receipt());

		expect(result).toMatchObject({
			store: 'Costco',
			referenceLabel: 'Receipt',
			displayId: '21134300800232509051234',
			date: '2026-09-05',
			isInStore: true,
			subtotal: 40.47,
			tax: 2.03,
			total: 42.5,
			adjustments: [],
			savings: 4.5,
			payments: ['VISA']
		});
		expect(result?.items).toEqual([
			{ name: 'KS PAPER TOWEL 12 ROLLS', quantity: 1, amount: 22.99 },
			{ name: 'Instant savings /1234567', quantity: 1, amount: -4.5 },
			{ name: 'ROTISSERIE CHICKEN', quantity: 2, amount: 21.98 }
		]);
		expect((result?.items ?? []).reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(result?.subtotal ?? 0, 2);
	});

	it("adds an adjustment for anything Costco doesn't itemize, so the receipt matches the charge", () => {
		expect(receiptFromCostco(receipt({ total: 43 }))?.adjustments).toEqual([{ label: 'Adjustment', amount: 0.5 }]);
	});

	it("isn't sent for a return", () => {
		expect(receiptFromCostco(receipt({ transactionType: 'Refund', total: -22.99 }))).toBeNull();
	});
});
