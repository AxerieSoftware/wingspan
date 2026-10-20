/** A loan's balances, negative while money is owed, as Monarch stores them. */
export interface LoanBalances {
	accountId: string;
	displayName: string;
	businessEntity: { id: string } | null;
	/** Null when Monarch has no balance for that day, as for a loan added later. */
	startBalance: number | null;
	/** Null when Monarch has no balance for that day, as for a loan closed before then. */
	endBalance: number | null;
	currentBalance: number;
	/** A loan whose balance the household enters by hand, so it only changes when they update it. */
	isManual: boolean;
	/** Yearly, as a percentage; null or 0 when Monarch has none. */
	interestRate: number | null;
}

/** A manual loan's balance as last entered: what was owed, and the first day Monarch had it. */
export interface EnteredBalance {
	owed: number;
	date: string;
}
