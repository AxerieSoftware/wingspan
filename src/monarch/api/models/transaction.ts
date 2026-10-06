/** One of the household's transactions in Monarch, using Monarch's sign convention: spending is negative. */
export interface Transaction {
	id: string;
	date: string;
	amount: number;
	description: string;
	merchantName?: string;
	merchantId?: string;
	logoUrl?: string;
	category?: TransactionCategory;
	accountId?: string;
	isRecurring?: boolean;
	hideFromReports?: boolean;
	/** Not yet posted. Banks differ on whether a pending one is in the account's balance yet. */
	pending?: boolean;
}

export interface TransactionCategory {
	id: string;
	name: string;
	icon: string | null;
	/** "expense", "income" or "transfer". */
	groupType?: string;
}
