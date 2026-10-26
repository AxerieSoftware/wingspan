/** One of a transaction's splits, with what a rebuilt split keeps from it. */
export interface TransactionSplit {
	id: string;
	amount: number;
	categoryId: string;
	notes: string | null;
	merchantName: string;
	tagIds: string[];
	ownerUserId: string | null;
	businessEntityId: string | null;
	hideFromReports: boolean;
	reviewStatus: string | null;
	needsReviewByUserId: string | null;
}

/** A transaction split into others, as the statement shows it, and its splits. */
export interface SplitTransaction {
	id: string;
	amount: number;
	notes: string | null;
	splits: TransactionSplit[];
}

/** A split to save. Without an id, it's a new one. */
export type TransactionSplitInput = Omit<TransactionSplit, 'id'> & { id?: string };
