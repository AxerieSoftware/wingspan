import * as v from 'valibot';
import { MONTH_PATTERN } from '../../../../common/calendar';

/** A logo's URL or an emoji. Without one, the item shows its initial. */
export type RecurringItemIcon = { kind: 'logo'; url: string } | { kind: 'emoji'; value: string };

/** Finds an item's payments by text in their description or merchant, optionally from one account and of any amount. */
export interface MerchantContainsMatchRule {
	matchText: string;
	accountId?: string;
	anyAmount?: boolean;
}

/** Due dates from `from` up to, not including, `before`. */
export interface OwedSpan {
	from: string;
	before: string;
}

/** One of Wingspan's recurring items. `since` is the month it was added, and nothing before it is owed. */
export interface RecurringItem {
	id: string;
	kind: string;
	name: string;
	recurrence: Recurrence;
	amount: number;
	active: boolean;
	since: string;
	icon?: RecurringItemIcon;
	notes?: string;
	matchRule?: MerchantContainsMatchRule;
	/** Date ranges before the schedule's start whose due dates are still owed, kept when an edit only moves the due date later. */
	owedSpans?: OwedSpan[];
}

/**
 * An iCalendar recurrence rule (RFC 5545), the subset RecurrenceCalculator reads and writes.
 *
 * - Monthly on the 1st: `DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1`
 * - Monthly on the 30th, or the month's last day when it's shorter: `…;BYMONTHDAY=28,29,30;BYSETPOS=-1`
 * - Last day of the month: `…RRULE:FREQ=MONTHLY;BYMONTHDAY=-1`
 * - Twice a month: `…RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15`
 * - Every other week: `…RRULE:FREQ=WEEKLY;INTERVAL=2` (the weekday comes from DTSTART)
 * - Every 3 months, or yearly: `…RRULE:FREQ=MONTHLY;INTERVAL=3`, `…RRULE:FREQ=YEARLY`
 */
export type Recurrence = string;

const RecurringItemIconSchema: v.GenericSchema<RecurringItemIcon> = v.variant('kind', [
	v.looseObject({ kind: v.literal('logo'), url: v.string() }),
	v.looseObject({ kind: v.literal('emoji'), value: v.string() })
]);

const MerchantContainsMatchRuleSchema: v.GenericSchema<MerchantContainsMatchRule> = v.looseObject({
	matchText: v.string(),
	accountId: v.optional(v.string()),
	anyAmount: v.optional(v.boolean())
});

/** Unknown fields are kept so data saved by a newer version isn't lost. */
export const RecurringItemSchema: v.GenericSchema<RecurringItem> = v.looseObject({
	id: v.string(),
	kind: v.string(),
	name: v.string(),
	recurrence: v.pipe(v.string(), v.includes('RRULE:')),
	amount: v.number(),
	active: v.boolean(),
	since: v.pipe(v.string(), v.regex(MONTH_PATTERN)),
	icon: v.optional(RecurringItemIconSchema),
	notes: v.optional(v.string()),
	matchRule: v.optional(MerchantContainsMatchRuleSchema),
	owedSpans: v.optional(
		v.array(
			v.looseObject({
				from: v.pipe(v.string(), v.isoDate()),
				before: v.pipe(v.string(), v.isoDate())
			})
		)
	)
});
