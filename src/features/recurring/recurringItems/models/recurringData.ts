import * as v from 'valibot';
import { MONTH_PATTERN } from '../../../../common/calendar';
import { type RecurringItem, RecurringItemSchema } from './recurringItem';

/** Wingspan's recurring items as saved. `trackingSince` is the month the first was saved, empty before then. */
export interface RecurringData {
	trackingSince: string;
	recurringItems: RecurringItem[];
}

export const emptyRecurringData = (): RecurringData => ({ trackingSince: '', recurringItems: [] });

export const RecurringDataSchema: v.GenericSchema<RecurringData> = v.looseObject({
	trackingSince: v.union([v.literal(''), v.pipe(v.string(), v.regex(MONTH_PATTERN))]),
	recurringItems: v.array(RecurringItemSchema)
});
