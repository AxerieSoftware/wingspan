import type { RecurringItem } from './recurringItem';
import type { Schedule } from './schedule';

/** A field the user changed in the editor, which picking payments later won't overwrite. */
export type EditedField = 'name' | 'amount' | 'schedule' | 'matchRule' | 'icon' | 'account';

/** An item being edited. Its schedule is kept separate until it's saved as a recurrence. */
export interface RecurringItemDraft {
	item: RecurringItem;
	schedule: Schedule;
}
