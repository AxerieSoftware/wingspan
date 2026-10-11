import { roundToCents } from '../../../../common/money';
import type { TaggedTransaction } from '../../../../monarch/api/models/taggedTransaction';
import type { HsaReimbursementTags } from './hsaReimbursementTags';

/** Tagged expenses split into those still to reimburse, oldest first, and those reimbursed, newest first, with each list's total. */
export interface HsaExpenses {
	toReimburse: TaggedTransaction[];
	toReimburseTotal: number;
	reimbursed: TaggedTransaction[];
	reimbursedTotal: number;
}

/**
 * Each transaction lands in exactly one list, so the two totals add up to everything tagged. One with both tags counts
 * as reimbursed, since the reimbursed tag is added last. Totals are what was spent: a refund with the tag lowers them.
 */
export function toHsaExpenses(transactions: TaggedTransaction[], tags: HsaReimbursementTags): HsaExpenses {
	const uniqueTransactions = [...new Map(transactions.map(transaction => [transaction.id, transaction])).values()];
	const reimbursed = uniqueTransactions.filter(transaction => tags.reimbursedTagId !== '' && transaction.tagIds.includes(tags.reimbursedTagId)).sort((a, b) => b.date.localeCompare(a.date));
	const toReimburse = uniqueTransactions
		.filter(transaction => tags.toReimburseTagId !== '' && transaction.tagIds.includes(tags.toReimburseTagId) && !reimbursed.includes(transaction))
		.sort((a, b) => a.date.localeCompare(b.date));
	return { toReimburse, toReimburseTotal: spentIn(toReimburse), reimbursed, reimbursedTotal: spentIn(reimbursed) };
}

function spentIn(transactions: TaggedTransaction[]): number {
	return roundToCents(transactions.reduce((total, transaction) => total - transaction.amount, 0));
}
