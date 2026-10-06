import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { Formatter } from '../../../../monarch/ui/formatter';
import type { StoreReceipt } from '../models/storeReceipt';
import { ReceiptPdf } from './receiptPdf';

const pdf = new ReceiptPdf(new Formatter(new Calendar(() => Temporal.PlainDate.from('2026-10-04'))));
const receipt = (items: StoreReceipt['items']): StoreReceipt => ({
	store: 'Walmart',
	referenceLabel: 'Order',
	orderId: '900000000000001',
	displayId: '1234567-89012345',
	date: '2026-09-20',
	isInStore: false,
	items,
	subtotal: 14.48,
	adjustments: [{ label: 'Driver tip', amount: 5 }],
	tax: 1.02,
	total: 20.5,
	savings: 2.62,
	payments: ['Visa ending in 0000']
});
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** Every object in the cross-reference table starts at its listed offset, and the trailer points to the table. */
function expectValidStructure(file: string) {
	const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(file)?.[1]);
	expect(file.slice(startxref, startxref + 4)).toBe('xref');
	const [, count] = /xref\n0 (\d+)\n/.exec(file.slice(startxref)) ?? [];
	const offsets = [...file.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map(match => Number(match[1]));
	expect(offsets).toHaveLength(Number(count) - 1);
	offsets.forEach((offset, index) => expect(file.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
	for (const [, length, stream] of file.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) expect(stream?.length).toBe(Number(length));
}

describe('a receipt as a PDF', () => {
	it('is a well-formed PDF with the store, order, items and totals Monarch reads', () => {
		const file = text(pdf.render(receipt([{ name: 'Bananas', quantity: 2, amount: 1.5 }])));

		expect(file.startsWith('%PDF-1.4\n')).toBe(true);
		expectValidStructure(file);
		for (const expected of ['(Walmart)', 'Order #1234567-89012345', 'Date: 2026-09-20', '2 x Bananas', '$1.50', 'Driver tip', 'Total', '$20.50']) expect(file).toContain(expected);
	});

	it("escapes characters PDF text can't hold and adds pages for long orders", () => {
		const items = Array.from({ length: 80 }, (_, index) => ({ name: `Item (${index}) \\ “quoted” 😀`, quantity: 1, amount: 1 }));
		const file = text(pdf.render(receipt(items)));

		expectValidStructure(file);
		expect(file).toContain('/Count 2');
		expect(file).toContain('Item \\(0\\) \\\\ "quoted" ?');
	});

	it("names its file by the order's date and number", () => {
		expect(pdf.fileName(receipt([]))).toBe('walmart-2026-09-20-1234567-89012345.pdf');
	});
});
