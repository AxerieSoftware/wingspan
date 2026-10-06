import type { Account } from '../../../../monarch/api/models/account';
import type { Transaction } from '../../../../monarch/api/models/transaction';

const INTEREST_PATTERN = /\binterest\b|\bfinance charge\b/i;

/** The credit limit the household entered in Monarch, falling back to the bank's. A limit of $0 is treated as unknown. */
export const creditLimitOf = (account: Account): number | null => [account.limit, account.dataProviderCreditLimit].find(limit => !!limit && limit > 0) ?? null;

/** The card's APR as a percentage, or null when Monarch has none. */
export const aprOf = (account: Account): number | null => account.apr ?? account.interestRate ?? null;

/** Monarch's minimum payment on the card's latest statement, or null when it doesn't know it. */
export const minimumPaymentOf = (account: Account): number | null => account.minimumPayment ?? null;

/** Whether a transaction is a card interest charge, by its category or description. The projection calculates interest itself. */
export const isInterestCharge = (transaction: Transaction): boolean =>
	transaction.amount < 0 && (INTEREST_PATTERN.test(transaction.category?.name ?? '') || INTEREST_PATTERN.test(transaction.description));
