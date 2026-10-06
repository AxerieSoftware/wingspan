import type { RecurringItem } from '../../recurringItems/models/recurringItem';

export const CARD_PAYMENT_KIND = 'card';

/** A card's payment. `accountId` is the card's Monarch account, unset for a card not in Monarch. */
export interface CardPaymentItem extends RecurringItem {
	kind: typeof CARD_PAYMENT_KIND;
	accountId?: string;
}
