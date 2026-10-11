/** One of the household's transaction tags in Monarch. */
export interface TransactionTag {
	id: string;
	name: string;
	color: string;
}

/** A transaction with a tag, with the notes and attachments kept on it as its record. Spending is negative. */
export interface TaggedTransaction {
	id: string;
	date: string;
	amount: number;
	merchantName: string;
	logoUrl?: string;
	accountName?: string;
	notes: string;
	hasAttachments: boolean;
	tagIds: string[];
}
