import type { HistoryPoint } from './historyPoint';
import type { Occurrence } from './occurrence';

/** Which payments settled which due dates, calculated for all items at once. `outstandingOccurrences` excludes paid occurrences from earlier months. */
export interface PaymentLedger {
	settledOccurrences: Occurrence[];
	settledByKey: ReadonlyMap<string, Occurrence>;
	outstandingOccurrences: Occurrence[];
	historiesByItemId: ReadonlyMap<string, HistoryPoint[]>;
}
