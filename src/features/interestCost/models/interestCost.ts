import { DAYS_PER_YEAR, MONTHS_PER_YEAR, PERCENT } from '../../../common/money';
import type { Account } from '../../../monarch/api/models/account';

/** One debt's interest at today's balance and rate. */
/** A loan's yearly rate as a percentage, or null when Monarch has none (a rate of 0 means none). */
export const loanRateOf = (account: Pick<Account, 'interestRate'>): number | null => (account.interestRate && account.interestRate > 0 ? account.interestRate : null);

export interface DebtInterest {
	accountId: string;
	name: string;
	/** Monarch's name for the account's group on Accounts, like "Loans" or "Credit Cards". */
	groupName: string;
	owed: number;
	/** Yearly, as a percentage. */
	rate: number;
	/** Whether the rate came from the card's last interest charge, since Monarch has no APR for it. */
	isRateImplied: boolean;
}

/**
 * Interest at today's balances, as simple interest: a year's is what's owed times the rate, a day's is a 365th of
 * it and a month's a 12th. Loans and card balances accrue daily, so this is what a day, month or year of them costs.
 */
export class InterestCost {
	public constructor(public readonly debts: readonly DebtInterest[]) {}

	public get yearly(): number {
		return this.debts.reduce((total, debt) => total + InterestCost.yearlyOf(debt), 0);
	}

	public get monthly(): number {
		return this.yearly / MONTHS_PER_YEAR;
	}

	public get daily(): number {
		return this.yearly / DAYS_PER_YEAR;
	}

	/** Just the debts in that group on Accounts, like "Loans". */
	public inGroup(groupName: string): InterestCost {
		return new InterestCost(this.debts.filter(debt => debt.groupName === groupName));
	}

	public static yearlyOf(debt: Pick<DebtInterest, 'owed' | 'rate'>): number {
		return (debt.owed * debt.rate) / PERCENT;
	}
}
