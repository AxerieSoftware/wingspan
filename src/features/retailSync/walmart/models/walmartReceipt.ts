import * as v from 'valibot';
import { roundToCents } from '../../../../common/money';
import { balancedAdjustments, type ReceiptItem, type ReceiptLine, type StoreReceipt } from '../../shared/models/storeReceipt';

const PriceLineSchema = v.looseObject({ label: v.nullish(v.string()), value: v.nullish(v.number()) });
const PriceLinesSchema = v.nullish(v.array(PriceLineSchema), []);

/** The fields of Walmart's `getOrder` response that a receipt needs. Everything else is ignored. */
export const WalmartOrderSchema = v.looseObject({
	id: v.string(),
	displayId: v.nullish(v.string()),
	orderDate: v.string(),
	groups_2101: v.nullish(
		v.array(
			v.looseObject({
				items: v.nullish(
					v.array(
						v.looseObject({
							quantity: v.nullish(v.number()),
							productInfo: v.nullish(v.looseObject({ name: v.nullish(v.string()) })),
							priceInfo: v.nullish(v.looseObject({ linePrice: v.nullish(PriceLineSchema) }))
						})
					)
				)
			})
		),
		[]
	),
	priceDetails: v.looseObject({
		subTotal: v.nullish(PriceLineSchema),
		taxTotal: v.nullish(PriceLineSchema),
		grandTotal: PriceLineSchema,
		fees: PriceLinesSchema,
		discounts: PriceLinesSchema,
		driverTip: v.nullish(PriceLineSchema),
		savings: v.nullish(PriceLineSchema)
	}),
	paymentMethods: v.nullish(v.array(v.looseObject({ description: v.nullish(v.string()), paymentType: v.nullish(v.string()) })), [])
});

export type WalmartOrder = v.InferOutput<typeof WalmartOrderSchema>;

/** The receipt for an order, or null when Walmart doesn't return a total. */
export function receiptFromOrder(order: WalmartOrder, isInStore: boolean): StoreReceipt | null {
	const { priceDetails } = order;
	const total = priceDetails.grandTotal.value;
	if (typeof total !== 'number') return null;

	const items = (order.groups_2101 ?? [])
		.flatMap(group => group.items ?? [])
		.map((item): ReceiptItem => ({ name: item.productInfo?.name?.trim() || 'Item', quantity: item.quantity ?? 1, amount: roundToCents(item.priceInfo?.linePrice?.value ?? 0) }));
	const subtotal = roundToCents(priceDetails.subTotal?.value ?? items.reduce((sum, item) => sum + item.amount, 0));
	const tax = roundToCents(priceDetails.taxTotal?.value ?? 0);
	const lineOf = (line: { label?: string | null; value?: number | null }, fallback: string, sign: 1 | -1): ReceiptLine | null =>
		line.value ? { label: line.label?.trim() || fallback, amount: roundToCents(sign * Math.abs(line.value)) } : null;
	const adjustments = [
		...(priceDetails.fees ?? []).map(fee => lineOf(fee, 'Fee', 1)),
		...(priceDetails.discounts ?? []).map(discount => lineOf(discount, 'Discount', -1)),
		priceDetails.driverTip ? lineOf(priceDetails.driverTip, 'Driver tip', 1) : null
	].filter((line): line is ReceiptLine => line !== null);

	return {
		store: 'Walmart',
		orderId: order.id,
		displayId: order.displayId ?? order.id,
		referenceLabel: 'Order',
		date: order.orderDate.slice(0, 10),
		isInStore,
		items,
		subtotal,
		adjustments: balancedAdjustments(subtotal, tax, adjustments, total),
		tax,
		total: roundToCents(total),
		savings: roundToCents(Math.abs(priceDetails.savings?.value ?? 0)),
		payments: (order.paymentMethods ?? []).map(payment => payment.description?.trim() || payment.paymentType || '').filter(Boolean)
	};
}
