import { CENT_TOLERANCE, roundToCents } from '../../../../common/money';

/** A fee, discount or tip. Positive adds to the total, negative subtracts. */
export interface ReceiptLine {
	label: string;
	amount: number;
}

/** One line item. `amount` is the total price for the line, negative for a saving. */
export interface ReceiptItem {
	name: string;
	quantity: number;
	amount: number;
}

/** One store purchase as a receipt for Monarch. Its lines always add up to its total. */
export interface StoreReceipt {
	store: string;
	/** The store's id for the purchase, which Wingspan uses to track what was sent. */
	orderId: string;
	/** What the store prints on it: an order number or a receipt barcode. */
	displayId: string;
	referenceLabel: 'Order' | 'Receipt';
	/** "YYYY-MM-DD". */
	date: string;
	isInStore: boolean;
	items: ReceiptItem[];
	subtotal: number;
	/** Fees, discounts and tips. Positive adds to the total, negative subtracts. */
	adjustments: ReceiptLine[];
	tax: number;
	total: number;
	/** The amount saved, already subtracted from item prices. Shown for display only, not counted again. */
	savings: number;
	payments: string[];
}

const ADJUSTMENT_LABEL = 'Adjustment';

/**
 * The adjustments, plus one more if the listed lines don't add up to the amount charged (e.g. a charge the store
 * doesn't itemize). That way the receipt total matches the transaction Monarch needs to find.
 */
export function balancedAdjustments(subtotal: number, tax: number, adjustments: ReceiptLine[], total: number): ReceiptLine[] {
	const listed = subtotal + tax + adjustments.reduce((sum, line) => sum + line.amount, 0);
	const unlisted = roundToCents(total - listed);
	return Math.abs(unlisted) > CENT_TOLERANCE ? [...adjustments, { label: ADJUSTMENT_LABEL, amount: unlisted }] : adjustments;
}
