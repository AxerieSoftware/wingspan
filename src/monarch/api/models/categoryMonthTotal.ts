/** What one category came to in one month, as Monarch's budget counts it: spending for an expense category, earnings for an income one. */
export interface CategoryMonthTotal {
	categoryId: string;
	/** "YYYY-MM". */
	month: string;
	amount: number;
}
