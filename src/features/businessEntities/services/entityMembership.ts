import type { Account } from '../../../monarch/api/models/account';
import { occurrenceAccountId, type RecurringFlow } from '../../../monarch/api/models/recurringFlow';
import type { RecurringItemKindRegistry } from '../../recurring/recurringItems/kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../../recurring/recurringItems/models/recurringItem';
import { type EntityScope, entityIdOf } from '../models/entityScope';

export interface ScopedMembership {
	/** Items with no account, or an account Monarch no longer has, belong to Household. */
	includesAccount(accountId: string | undefined): boolean;
	includesItem(item: RecurringItem): boolean;
	accounts(accounts: readonly Account[]): Account[];
	/** Monarch's recurring items, keeping only occurrences on the scope's accounts. Items with no occurrences left are dropped. */
	recurringFlows(flows: readonly RecurringFlow[]): RecurringFlow[];
}

/** Which accounts, items and recurring flows belong to the selected entities. */
export class EntityMembership {
	public constructor(private readonly kinds: RecurringItemKindRegistry) {}

	/** An item belongs to the account its money moves through: the card for a card payment, otherwise the account it's paid from. */
	public itemAccountId(item: RecurringItem): string | undefined {
		const linkedAccountId = this.kinds.supports(item) ? this.kinds.of(item).linkedAccountId(item) : undefined;
		return linkedAccountId ?? item.matchRule?.accountId;
	}

	public within(scope: EntityScope, accounts: readonly Account[]): ScopedMembership {
		const accountsById = new Map(accounts.map(account => [account.id, account]));
		const includesAccount = (accountId: string | undefined) => scope.includes(entityIdOf(accountId ? accountsById.get(accountId) : undefined));
		return {
			includesAccount,
			includesItem: item => includesAccount(this.itemAccountId(item)),
			accounts: candidates => candidates.filter(account => scope.includes(entityIdOf(account))),
			recurringFlows: flows =>
				scope.isEverything
					? [...flows]
					: flows.flatMap(flow => {
							const occurrences = flow.occurrences.filter(occurrence => includesAccount(occurrenceAccountId(flow, occurrence)));
							return occurrences.length ? [{ ...flow, occurrences, allOccurrences: flow.allOccurrences ?? flow.occurrences }] : [];
						})
		};
	}
}
