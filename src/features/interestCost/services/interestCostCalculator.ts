import type { Calendar } from '../../../common/calendar';
import type { MonarchSnapshot } from '../../../data/services/monarchDataService';
import type { Account } from '../../../monarch/api/models/account';
import { MonarchAccountType } from '../../../monarch/api/models/monarchValues';
import { type EntityScope, entityIdOf } from '../../businessEntities/models/entityScope';
import { aprOf, impliedAprOf, lastInterestChargesByAccountId } from '../../cashFlow/projectedBalances/models/cardTerms';
import { type DebtInterest, InterestCost, loanRateOf } from '../models/interestCost';

/**
 * Which debts cost interest now: loans with a rate in Monarch, and cards charged interest lately, since a card paid in
 * full each month costs none. A card with no APR in Monarch gets the rate its last interest charge implies.
 */
export class InterestCostCalculator {
	public constructor(private readonly calendar: Calendar) {}

	public calculate({ accounts, transactions, owedByAccountId }: Pick<MonarchSnapshot, 'accounts' | 'transactions' | 'owedByAccountId'>, scope: EntityScope): InterestCost {
		const lastInterestByAccountId = lastInterestChargesByAccountId(transactions, this.calendar);
		const debts = accounts
			.filter(account => !account.isHidden && scope.includes(entityIdOf(account)))
			.flatMap(account => {
				const owed = owedByAccountId[account.id] ?? 0;
				if (owed <= 0) return [];
				const debt = this.debtOf(account, owed, lastInterestByAccountId.get(account.id));
				return debt ? [debt] : [];
			});
		return new InterestCost(debts);
	}

	private debtOf(account: Account, owed: number, lastInterest: number | undefined): DebtInterest | null {
		const base = { accountId: account.id, name: account.displayName, groupName: account.type.display, owed };
		if (account.type.name === MonarchAccountType.loan) {
			const rate = loanRateOf(account);
			return rate === null ? null : { ...base, rate, isRateImplied: false };
		}

		if (account.type.name !== MonarchAccountType.credit || lastInterest === undefined) return null;
		const apr = aprOf(account);
		if (apr) return { ...base, rate: apr, isRateImplied: false };
		return { ...base, rate: impliedAprOf(lastInterest, owed), isRateImplied: true };
	}
}
