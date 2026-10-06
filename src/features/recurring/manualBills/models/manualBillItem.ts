import type { RecurringItem } from '../../recurringItems/models/recurringItem';

export const MANUAL_BILL_KIND = 'bill';

export interface ManualBillItem extends RecurringItem {
	kind: typeof MANUAL_BILL_KIND;
}
