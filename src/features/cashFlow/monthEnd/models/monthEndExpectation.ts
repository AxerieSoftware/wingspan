/** What's still expected this month, from today through its last day, on top of what Monarch already has. Both are positive amounts. */
export interface MonthEndExpectation {
	monthEnd: string;
	income: number;
	expenses: number;
}
