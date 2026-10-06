import type { Calendar } from '../../../../common/calendar';
import { MonarchOccurrenceStatus } from '../../../../monarch/api/models/monarchValues';
import type { RecurrenceGroupPeriod } from '../../../../monarch/api/models/recurrenceGroupPeriod';
import type { RecurringV2Item } from '../../../../monarch/pages/recurringV2/models/recurringV2Item';
import type { MonarchItemMonth } from '../models/monarchItemMonth';

const REPEATS_WITHIN_MONTH_PATTERN = /weekly|semimonthly|semi_monthly|twice/i;

/** Due dates for Monarch's own recurring items, from its occurrences or a custom day. */
export class DueDateCalculator {
	public constructor(private readonly calendar: Calendar) {}

	/** The group's occurrences in `month`, in date order. A weekly or twice-monthly item counts as repeating even if only one occurrence falls in the month. */
	public itemMonth(group: RecurrenceGroupPeriod, month: string): MonarchItemMonth {
		const occurrences = group.occurrences.filter(occurrence => occurrence.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
		const repeatsInMonth = occurrences.length > 1 || REPEATS_WITHIN_MONTH_PATTERN.test(group.recurrenceGroup.frequency);
		return { group, occurrences, repeatsInMonth, isAllPaid: occurrences.length > 0 && occurrences.every(occurrence => occurrence.status === MonarchOccurrenceStatus.paid) };
	}

	/** A custom day past the end of the month is clamped to its last day. Without a custom day, uses the next unpaid date Monarch expects. */
	public dueDate(itemMonth: MonarchItemMonth, month: string, customDueDay: number | undefined): string | null {
		if (customDueDay && !itemMonth.repeatsInMonth) return this.calendar.dayInMonth(month, customDueDay);
		const nextUnpaid = itemMonth.occurrences.find(occurrence => occurrence.status !== MonarchOccurrenceStatus.paid) ?? itemMonth.occurrences.at(-1);
		return nextUnpaid?.date ?? itemMonth.group.date ?? null;
	}

	/** Matches Monarch's rows to its items by name, in date order, so two items with the same name each get their own row. */
	public pair(monarchItems: RecurringV2Item[], itemMonths: MonarchItemMonth[]): Map<RecurringV2Item, MonarchItemMonth> {
		const itemMonthsByName = new Map<string, MonarchItemMonth[]>();
		for (const itemMonth of [...itemMonths].sort((a, b) => (a.group.date ?? '').localeCompare(b.group.date ?? ''))) {
			const name = itemMonth.group.recurrenceGroup.name.trim();
			const sameNamed = itemMonthsByName.get(name);
			if (sameNamed) sameNamed.push(itemMonth);
			else itemMonthsByName.set(name, [itemMonth]);
		}

		const pairedItemMonths = new Map<RecurringV2Item, MonarchItemMonth>();
		for (const monarchItem of monarchItems) {
			const pairedItemMonth = itemMonthsByName.get(monarchItem.name)?.shift();
			if (pairedItemMonth) pairedItemMonths.set(monarchItem, pairedItemMonth);
		}

		return pairedItemMonths;
	}
}
