import { CENT_TOLERANCE } from '../../../../common/money';
import type { ExistingReceipt } from '../../../../monarch/api/monarchReceiptsClient';
import type { StoreReceipt } from './storeReceipt';

/**
 * Finds the receipt Monarch already has for a purchase: same store, same total to the cent and same day. Each Monarch
 * receipt matches only one purchase, so two identical purchases on the same day need two receipts.
 */
export class ExistingReceiptMatcher {
	private readonly unclaimed: ExistingReceipt[];

	public constructor(existing: readonly ExistingReceipt[]) {
		this.unclaimed = [...existing];
	}

	/** Whether Monarch already has the purchase. A matched receipt can't be matched again. */
	public claim(receipt: StoreReceipt): boolean {
		const store = receipt.store.toLowerCase();
		const index = this.unclaimed.findIndex(existing => existing.date === receipt.date && Math.abs(existing.total - receipt.total) < CENT_TOLERANCE && existing.merchant.toLowerCase().includes(store));
		if (index < 0) return false;
		this.unclaimed.splice(index, 1);
		return true;
	}
}
