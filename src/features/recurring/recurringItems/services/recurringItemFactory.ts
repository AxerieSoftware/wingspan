import type { Calendar } from '../../../../common/calendar';
import { isSameValue } from '../../../../common/sameValue';
import type { Confirmation } from '../../../../monarch/ui/components/confirmDialog';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../models/recurringItem';
import type { RecurringItemDraft } from '../models/recurringItemDraft';
import type { RecurrenceCalculator } from './recurrenceCalculator';

const DEFAULT_MONTH_DAY = 1;

export class RecurringItemFactory {
	public constructor(
		private readonly calendar: Calendar,
		private readonly recurrence: RecurrenceCalculator,
		private readonly kinds: RecurringItemKindRegistry
	) {}

	/** A new item of `kind`, due monthly on the 1st from this month. */
	public blankDraft(kind: string): RecurringItemDraft {
		const schedule = this.recurrence.monthly(DEFAULT_MONTH_DAY);
		const item: RecurringItem = {
			id: crypto.randomUUID(),
			kind: this.kinds.named(kind).kind,
			name: '',
			recurrence: this.recurrence.toRecurrence(schedule),
			amount: 0,
			active: true,
			since: this.calendar.currentMonth()
		};
		return { item, schedule };
	}

	/** A copy of a saved item for editing, so the saved item isn't changed until the edit is saved. */
	public draftOf(item: RecurringItem): RecurringItemDraft {
		return { item: structuredClone(item), schedule: this.recurrence.fromRecurrence(item.recurrence) };
	}

	/**
	 * `editedItem` is the item before this edit. Moving only the due day or next due date doesn't clear what was due up
	 * to today; those stay owed on the new day. Changing the frequency, amount or match rule resets the item, since old
	 * due dates can't be checked against the new settings.
	 */
	public itemFrom(draft: RecurringItemDraft, editedItem?: RecurringItem): RecurringItem {
		const { owedSpans: _, ...item } = draft.item;
		const recurrence = this.recurrence.toRecurrence(draft.schedule);
		if (!editedItem || !this.isOnlyRescheduled(editedItem, { ...item, recurrence })) return { ...item, recurrence };

		const oldStart = this.recurrence.startOf(editedItem.recurrence);
		const tomorrow = this.calendar.addDays(this.calendar.today(), 1);
		const spans = [...(editedItem.owedSpans ?? []), ...(oldStart < tomorrow ? [{ from: oldStart, before: tomorrow }] : [])];
		// Skip ranges at or after the new start, since the schedule already covers those due dates.
		const owedSpans = spans.filter(span => span.from < this.recurrence.startOf(recurrence));
		return owedSpans.length ? { ...item, recurrence, owedSpans } : { ...item, recurrence };
	}

	public removalConfirmation(item: RecurringItem): Confirmation {
		return { title: `Remove ${item.name || 'this item'}?`, message: 'This removes it from Recurring for everyone in your household when Wingspan saves to Monarch.', confirmLabel: 'Remove' };
	}

	private isOnlyRescheduled(before: RecurringItem, after: RecurringItem): boolean {
		return before.amount === after.amount && this.recurrence.cadenceOf(before.recurrence) === this.recurrence.cadenceOf(after.recurrence) && isSameValue(before.matchRule, after.matchRule);
	}
}
