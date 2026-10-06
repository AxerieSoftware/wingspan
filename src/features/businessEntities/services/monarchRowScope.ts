import { CENT_TOLERANCE } from '../../../common/money';
import type { RecurrenceGroupAccount } from '../../../monarch/api/models/recurrenceGroupAccount';
import type { RecurringV2Item } from '../../../monarch/pages/recurringV2/models/recurringV2Item';
import type { ScopedMembership } from './entityMembership';

interface GroupInScope {
	isIncluded: boolean;
	amount: number | null;
}

/** The word Monarch's footers use for each recurring type, as in "Show 2 inactive income groups". "items" covers every type. */
const INACTIVE_KINDS: Record<string, string | null> = { expense: 'expense', 'income group': 'income', statement: 'credit_card', transfer: 'transfer', item: null };

/** Which of Monarch's Recurring rows belong to the selected entities. A row only shows a name and an amount, so it's matched to Monarch's recurring items by those. */
export class MonarchRowScope {
	private readonly groupsByName = new Map<string, GroupInScope[]>();
	private readonly hiddenInactiveByType = new Map<string, number>();

	/** Null groups (still loading) hide all of Monarch's rows, since they could belong to any entity. */
	public constructor(
		private readonly groups: readonly RecurrenceGroupAccount[] | null,
		within: ScopedMembership
	) {
		const isIncluded = (group: RecurrenceGroupAccount) => group.accountIds.some(accountId => within.includesAccount(accountId ?? undefined));
		for (const group of groups ?? []) {
			const name = group.name.trim();
			// An item paid from more than one entity shows in each, since the projection counts each entity's occurrences.
			this.groupsByName.set(name, [...(this.groupsByName.get(name) ?? []), { isIncluded: isIncluded(group), amount: group.amount }]);
		}
		// Count an inactive row as hidden only when isShown would hide it, i.e. no item with that name is in scope.
		for (const group of groups ?? []) {
			if (group.isActive || this.groupsByName.get(group.name.trim())?.some(candidate => candidate.isIncluded)) continue;
			this.hiddenInactiveByType.set(group.recurringType, (this.hiddenInactiveByType.get(group.recurringType) ?? 0) + 1);
		}
	}

	/** Shown unless every matching item belongs to an unselected entity. */
	public isShown(item: RecurringV2Item): boolean {
		if (!this.groups) return false;
		const candidates = this.groupsByName.get(item.name.trim());
		if (!candidates || candidates.every(candidate => candidate.isIncluded)) return true;
		if (candidates.every(candidate => !candidate.isIncluded)) return false;

		// Same name in more than one entity: use the amount to decide when it only matches one entity's items.
		const sameAmount = candidates.filter(candidate => candidate.amount !== null && item.amount !== null && Math.abs(Math.abs(candidate.amount) - item.amount) < CENT_TOLERANCE);
		const [first] = sameAmount;
		return first && sameAmount.every(candidate => candidate.isIncluded === first.isIncluded) ? first.isIncluded : true;
	}

	/** For "Show 15 inactive expenses": the number of inactive items of that type that belong to unselected entities. */
	public hiddenInactiveCount(kind: string): number {
		if (!this.groups) return Number.POSITIVE_INFINITY;
		const singular = kind.toLowerCase().replace(/s$/, '');
		if (!(singular in INACTIVE_KINDS)) return 0;
		const recurringType = INACTIVE_KINDS[singular];
		return recurringType ? (this.hiddenInactiveByType.get(recurringType) ?? 0) : this.hiddenInactiveByType.values().reduce((total, count) => total + count, 0);
	}
}
