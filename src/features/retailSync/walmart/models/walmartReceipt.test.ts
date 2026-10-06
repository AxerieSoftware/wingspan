import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { receiptFromOrder, WalmartOrderSchema } from './walmartReceipt';

const line = (label: string, value: number) => ({ label, value, displayValue: `$${value}` });
const order = (overrides: Record<string, unknown> = {}, priceDetails: Record<string, unknown> = {}) =>
	v.parse(WalmartOrderSchema, {
		id: '900000000000001',
		displayId: '1234567-89012345',
		orderDate: '2026-09-20T18:11:00-05:00',
		groups_2101: [
			{
				items: [
					{ quantity: 2, productInfo: { name: 'Bananas' }, priceInfo: { linePrice: line('', 1.5) } },
					{ quantity: 1, productInfo: { name: 'Paper towels' }, priceInfo: { linePrice: line('', 12.98) } }
				]
			}
		],
		priceDetails: {
			subTotal: line('Subtotal', 14.48),
			taxTotal: line('Taxes', 1.02),
			grandTotal: line('Total', 15.5),
			fees: [],
			discounts: [],
			driverTip: null,
			savings: line('Savings', -2.62),
			...priceDetails
		},
		paymentMethods: [{ description: 'Visa ending in 0000', paymentType: 'CREDITCARD' }],
		customer: { firstName: 'Not kept' },
		...overrides
	});

describe('a Walmart order as a receipt', () => {
	it('lists each item and adds up to the order total, showing savings without counting them again', () => {
		const receipt = receiptFromOrder(order(), false);

		expect(receipt).toMatchObject({ displayId: '1234567-89012345', date: '2026-09-20', subtotal: 14.48, tax: 1.02, total: 15.5, savings: 2.62, adjustments: [], payments: ['Visa ending in 0000'] });
		expect(receipt?.items).toEqual([
			{ name: 'Bananas', quantity: 2, amount: 1.5 },
			{ name: 'Paper towels', quantity: 1, amount: 12.98 }
		]);
	});

	it("adds fees and the driver tip, subtracts discounts, and adds an adjustment for anything Walmart doesn't itemize", () => {
		const receipt = receiptFromOrder(order({}, { fees: [line('Bag fee', 0.2)], discounts: [line('Promo', 3)], driverTip: line('Driver tip', 5), grandTotal: line('Total', 20) }), false);

		expect(receipt?.adjustments).toEqual([
			{ label: 'Bag fee', amount: 0.2 },
			{ label: 'Promo', amount: -3 },
			{ label: 'Driver tip', amount: 5 },
			// 14.48 + 1.02 + 0.2 - 3 + 5 = 17.70; Walmart charged 20.
			{ label: 'Adjustment', amount: 2.3 }
		]);
		const listed = (receipt?.subtotal ?? 0) + (receipt?.tax ?? 0) + (receipt?.adjustments ?? []).reduce((sum, each) => sum + each.amount, 0);
		expect(listed).toBeCloseTo(20, 2);
	});

	it('handles discounts Walmart sends as negative amounts', () => {
		const receipt = receiptFromOrder(order({}, { discounts: [line('Promo', -3)], grandTotal: line('Total', 12.5) }), false);

		expect(receipt?.adjustments).toEqual([{ label: 'Promo', amount: -3 }]);
	});

	it("isn't a receipt without a total", () => {
		expect(receiptFromOrder(order({}, { grandTotal: { label: 'Total', value: null } }), false)).toBeNull();
	});

	it("doesn't keep any of the user's personal details", () => {
		expect(JSON.stringify(receiptFromOrder(order(), true))).not.toContain('Not kept');
	});
});
