import type { RecurringItem } from '../../recurringItems/models/recurringItem';

export const EXPECTED_INCOME_KIND = 'income';

export interface ExpectedIncomeItem extends RecurringItem {
	kind: typeof EXPECTED_INCOME_KIND;
}
