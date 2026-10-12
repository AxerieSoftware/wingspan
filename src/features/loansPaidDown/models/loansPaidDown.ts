/** How much one loan's balance went down; negative when it grew. */
export interface LoanPaydown {
	name: string;
	amount: number;
}

/** How much the loans shown went down over a period, and that as a share of the period's income. */
export interface LoansPaidDown {
	amount: number;
	/** Null when there was no income to compare against. */
	shareOfIncome: number | null;
	/** Largest paydown first. */
	loans: LoanPaydown[];
}
