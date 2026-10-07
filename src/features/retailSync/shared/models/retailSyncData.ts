import * as v from 'valibot';

/** Which of a store's purchases were sent to Monarch, so none are sent twice from any browser. */
export interface RetailSyncData {
	uploadedOrderIds: string[];
	/** "YYYY-MM-DD" of the last sync that finished; empty before the first. */
	lastSyncedOn: string;
}

/** Validates a store's saved sync record, filling in defaults for missing fields. */
export const RetailSyncDataSchema: v.GenericSchema<Partial<RetailSyncData>, RetailSyncData> = v.looseObject({
	uploadedOrderIds: v.optional(v.array(v.string()), () => []),
	lastSyncedOn: v.optional(v.string(), '')
});

export const emptyRetailSyncData = (): RetailSyncData => ({ uploadedOrderIds: [], lastSyncedOn: '' });

/** Combines uploads from both browsers regardless of the base, so a purchase that was sent is never sent again. */
export const mergeRetailSyncData = (theirs: RetailSyncData | undefined, ours: RetailSyncData | undefined): RetailSyncData => {
	const [their, our] = [theirs ?? emptyRetailSyncData(), ours ?? emptyRetailSyncData()];
	return {
		...their,
		...our,
		uploadedOrderIds: [...new Set([...their.uploadedOrderIds, ...our.uploadedOrderIds])],
		lastSyncedOn: their.lastSyncedOn > our.lastSyncedOn ? their.lastSyncedOn : our.lastSyncedOn
	};
};
