import * as v from 'valibot';
import { roundToCents } from '../../../../common/money';
import { balancedAdjustments, type ReceiptItem, type StoreReceipt } from '../../shared/models/storeReceipt';

/** The fields of a Costco warehouse or gas station receipt that Wingspan needs. Everything else is ignored. */
export const CostcoReceiptSchema = v.looseObject({
	transactionBarcode: v.string(),
	transactionDateTime: v.string(),
	transactionType: v.nullish(v.string()),
	warehouseName: v.nullish(v.string()),
	subTotal: v.nullish(v.number()),
	taxes: v.nullish(v.number()),
	total: v.number(),
	itemArray: v.nullish(
		v.array(
			v.looseObject({
				itemDescription01: v.nullish(v.string()),
				itemDescription02: v.nullish(v.string()),
				unit: v.nullish(v.number()),
				amount: v.nullish(v.number())
			})
		),
		[]
	),
	tenderArray: v.nullish(v.array(v.looseObject({ tenderDescription: v.nullish(v.string()), amountTender: v.nullish(v.number()) })), [])
});

export type CostcoReceipt = v.InferOutput<typeof CostcoReceiptSchema>;

/** Costco prints an instant saving as its own line, with the discounted item's number as the description: "/1234567". */
const isInstantSaving = (description: string) => description.startsWith('/');

/** A purchase, not a return. Returns refund money instead of charging it. */
export const isPurchase = (receipt: { total?: number | null; transactionType?: string | null }): boolean => (receipt.total ?? 0) > 0 && (receipt.transactionType ?? 'Sales') === 'Sales';

/** The receipt for a warehouse or gas station purchase. Null for a return, which Wingspan doesn't send. */
export function receiptFromCostco(receipt: CostcoReceipt): StoreReceipt | null {
	if (!isPurchase(receipt)) return null;
	const items = (receipt.itemArray ?? []).map((item): ReceiptItem => {
		const description = [item.itemDescription01, item.itemDescription02]
			.map(part => part?.trim())
			.filter(Boolean)
			.join(' ');
		return {
			name: isInstantSaving(description) ? `Instant savings ${description}` : description || 'Item',
			quantity: Math.abs(item.unit ?? 1) || 1,
			amount: roundToCents(item.amount ?? 0)
		};
	});
	const subtotal = roundToCents(receipt.subTotal ?? items.reduce((sum, item) => sum + item.amount, 0));
	const tax = roundToCents(receipt.taxes ?? 0);
	const total = roundToCents(receipt.total);
	const savings = roundToCents(-items.filter(item => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
	return {
		store: 'Costco',
		orderId: receipt.transactionBarcode,
		displayId: receipt.transactionBarcode,
		referenceLabel: 'Receipt',
		date: receipt.transactionDateTime.slice(0, 10),
		isInStore: true,
		items,
		subtotal,
		adjustments: balancedAdjustments(subtotal, tax, [], total),
		tax,
		total,
		// Instant savings are separate lines already counted in the subtotal, so they're only shown again as the total saved.
		savings,
		payments: (receipt.tenderArray ?? []).map(tender => tender.tenderDescription?.trim() ?? '').filter(Boolean)
	};
}
