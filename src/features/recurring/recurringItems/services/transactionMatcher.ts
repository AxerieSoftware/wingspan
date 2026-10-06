import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { RecurringItem } from '../models/recurringItem';
import type { TransactionPredicate } from '../models/transactionPredicate';

const MIN_AMOUNT_TOLERANCE = 5;
const AMOUNT_TOLERANCE_RATIO = 0.1;

/** Finds a recurring item's payments by its match rule. */
export class TransactionMatcher {
	private readonly searchableTextByTransaction = new WeakMap<Transaction, string>();

	/** Outflows whose bank description or merchant contains the match text; within 10% or $5 of the amount unless any amount is allowed. */
	public predicateFor(item: RecurringItem, checksAmount: boolean): TransactionPredicate | null {
		const matchRule = item.matchRule;
		const matchText = matchRule?.matchText.trim().toLowerCase();
		if (!matchRule || !matchText) return null;

		return transaction =>
			transaction.amount < 0 &&
			(!matchRule.accountId || transaction.accountId === matchRule.accountId) &&
			(matchRule.anyAmount || !checksAmount || this.amountFits(-transaction.amount, item.amount)) &&
			this.searchableText(transaction).includes(matchText);
	}

	/** The match rule for the details: its text in quotes and whether any amount counts, or a dash without one. */
	public describe(item: RecurringItem, alwaysAnyAmount: boolean): string {
		const matchRule = item.matchRule;
		if (!matchRule?.matchText) return '–';
		return `“${matchRule.matchText}”${matchRule.anyAmount || alwaysAnyAmount ? ', any amount' : ''}`;
	}

	private searchableText(transaction: Transaction): string {
		let searchableText = this.searchableTextByTransaction.get(transaction);
		if (searchableText === undefined) {
			searchableText = `${transaction.description} ${transaction.merchantName ?? ''}`.toLowerCase();
			this.searchableTextByTransaction.set(transaction, searchableText);
		}

		return searchableText;
	}

	private amountFits(actualAmount: number, expectedAmount: number): boolean {
		return Math.abs(actualAmount - expectedAmount) <= Math.max(MIN_AMOUNT_TOLERANCE, expectedAmount * AMOUNT_TOLERANCE_RATIO);
	}
}
