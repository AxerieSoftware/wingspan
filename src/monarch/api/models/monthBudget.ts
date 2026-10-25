/** What a month's budget plans to come in and go out. */
export interface MonthBudget {
	/** "YYYY-MM". */
	month: string;
	plannedIncome: number;
	plannedExpenses: number;
}
