import * as v from 'valibot';

/** Custom due days, 1 to 31, by Monarch recurrence group id. */
export interface RecurringDueDatesData {
	dueDatesByRecurrenceId: Record<string, number>;
}

export const emptyRecurringDueDatesData = (): RecurringDueDatesData => ({ dueDatesByRecurrenceId: {} });

export const RecurringDueDatesDataSchema: v.GenericSchema<RecurringDueDatesData> = v.looseObject({
	dueDatesByRecurrenceId: v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31)))
});
