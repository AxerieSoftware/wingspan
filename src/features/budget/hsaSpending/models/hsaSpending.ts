import { CENTS_PER_DOLLAR, toCents } from '../../../../common/money';

/**
 * What each category spent from an HSA in a month, in whole cents, from spending on HSA accounts and tagged expenses
 * paid some other way. The two never share a transaction, since tagged expenses on HSA accounts are left out of the second.
 *
 * Invariant: a row's amount is exactly the sum of its categories' amounts, and each category's is exactly the sum of its parts.
 */
export class HsaSpending {
	private readonly centsByCategoryId = new Map<string, number>();

	public constructor(...parts: ReadonlyMap<string, number>[]) {
		for (const part of parts) {
			for (const [categoryId, amount] of part) {
				this.centsByCategoryId.set(categoryId, (this.centsByCategoryId.get(categoryId) ?? 0) + toCents(amount));
			}
		}
	}

	/** The total for a Budget row: one category, or every category in a group. */
	public amountFor(categoryIds: readonly string[]): number {
		return categoryIds.reduce((total, categoryId) => total + (this.centsByCategoryId.get(categoryId) ?? 0), 0) / CENTS_PER_DOLLAR;
	}
}
