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
}
