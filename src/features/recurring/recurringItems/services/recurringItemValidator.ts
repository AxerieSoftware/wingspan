import { ISO_DATE_PATTERN } from '../../../../common/calendar';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../models/recurringItem';
import type { Schedule } from '../models/schedule';

/** Validation errors that block saving, as shown in the editor. */
export class RecurringItemValidator {
	public constructor(private readonly kinds: RecurringItemKindRegistry) {}

	/** `otherItems` are the household's saved items, so an account isn't tracked by two items at once. */
	public problemsWith(item: RecurringItem, schedule: Schedule, otherItems: readonly RecurringItem[]): string[] {
		const problems: string[] = [];
		if (!item.name.trim()) problems.push('Add a name.');
		const accountId = this.kinds.of(item).linkedAccountId(item);
		const tracker = accountId === undefined ? undefined : otherItems.find(other => other.id !== item.id && this.kinds.of(other).linkedAccountId(other) === accountId);
		if (tracker) problems.push(`${tracker.name} already tracks this card.`);
		if (!Number.isInteger(schedule.every) || schedule.every < 1) problems.push('Repeats every needs a whole number.');
		if (!ISO_DATE_PATTERN.test(schedule.start)) problems.push('Add the next due date.');
		if (schedule.twiceMonthlyDays && schedule.twiceMonthlyDays[0] === schedule.twiceMonthlyDays[1]) problems.push('Pick two different days.');
		return [...problems, ...this.kinds.of(item).problemsWith(item)];
	}
}
