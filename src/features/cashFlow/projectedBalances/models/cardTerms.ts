import type { Calendar } from '../../../../common/calendar';
import { MONTHS_PER_YEAR, PERCENT } from '../../../../common/money';
import type { Account } from '../../../../monarch/api/models/account';
import type { Transaction } from '../../../../monarch/api/models/transaction';

const INTEREST_PATTERN = /\binterest\b|\bfinance charge\b/i;
/** How far back an interest charge still means a card is carrying a balance: about two statements. */
const INTEREST_LOOKBACK_DAYS = 62;
/** About the highest APR card issuers charge. */
const MAX_IMPLIED_APR = 36;

/** The credit limit the household entered in Monarch, falling back to the bank's. A limit of $0 is treated as unknown. */
export const creditLimitOf = (account: Account): number | null => [account.limit, account.dataProviderCreditLimit].find(limit => !!limit && limit > 0) ?? null;

/** The card's APR as a percentage, or null when Monarch has none. Monarch's 0 means it doesn't know the rate. */
export const aprOf = (account: Account): number | null => account.apr || account.interestRate || null;

/** Monarch's minimum payment on the card's latest statement, or null when it doesn't know it. */
export const minimumPaymentOf = (account: Account): number | null => account.minimumPayment ?? null;

/** Whether a transaction is a card interest charge, by its category or description. The projection calculates interest itself. */
export const isInterestCharge = (transaction: Transaction): boolean =>
	transaction.amount < 0 && (INTEREST_PATTERN.test(transaction.category?.name ?? '') || INTEREST_PATTERN.test(transaction.description));

/** Each card's most recent interest charge in about the last two statements, as a positive amount. */
export function lastInterestChargesByAccountId(transactions: readonly Transaction[], calendar: Calendar): ReadonlyMap<string, number> {
	const sinceDate = calendar.addDays(calendar.today(), -INTEREST_LOOKBACK_DAYS);
	const latest = new Map<string, Transaction>();
	for (const transaction of transactions) {
		if (!transaction.accountId || transaction.date < sinceDate || !isInterestCharge(transaction)) continue;
		const current = latest.get(transaction.accountId);
		if (!current || transaction.date > current.date) latest.set(transaction.accountId, transaction);
	}
	return new Map([...latest].map(([accountId, transaction]) => [accountId, Math.abs(transaction.amount)]));
}

/** The yearly rate a month's interest charge implies on what's owed now. Capped, since a charge on an older, higher balance would imply an unrealistic rate on a paid-down card. */
export const impliedAprOf = (lastInterest: number, owed: number): number => Math.min(MAX_IMPLIED_APR, (lastInterest / owed) * MONTHS_PER_YEAR * PERCENT);
