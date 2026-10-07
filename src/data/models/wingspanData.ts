import * as v from 'valibot';
import { isSameValue } from '../../common/sameValue';
import { emptySavedCashSettings, hasChosenCashSettings, type SavedCashSettings, SavedCashSettingsSchema } from '../../features/cashFlow/cashSettings/models/savedCashSettings';
import { emptyRecurringDueDatesData, type RecurringDueDatesData, RecurringDueDatesDataSchema } from '../../features/recurring/dueDates/models/dueDatesData';
import { emptyRecurringData, type RecurringData, RecurringDataSchema } from '../../features/recurring/recurringItems/models/recurringData';
import { emptyRetailSyncData, mergeRetailSyncData, type RetailSyncData, RetailSyncDataSchema } from '../../features/retailSync/shared/models/retailSyncData';

/** The envelope version this build writes. Data saved with a higher version is never modified. */
export const CURRENT_SCHEMA_VERSION = 1;

/** Everything Wingspan saves for the household, in one envelope. */
export interface WingspanData {
	recurringDueDates: RecurringDueDatesData;
	recurring: RecurringData;
	/** Household cash and card settings. */
	cashSettings: SavedCashSettings;
	/** Cash and card settings for each business, keyed by Monarch's business id. */
	businessCashSettings: Record<string, SavedCashSettings>;
	/** Absent in data saved before Walmart was first synced. */
	walmartSync?: RetailSyncData;
	/** Absent in data saved before Costco was first synced. */
	costcoSync?: RetailSyncData;
}

/** Saved data before defaults are filled in. */
type SavedWingspanData = Omit<WingspanData, 'cashSettings' | 'businessCashSettings' | 'walmartSync' | 'costcoSync'> & {
	cashSettings?: SavedCashSettings;
	businessCashSettings?: Record<string, SavedCashSettings>;
	walmartSync?: Partial<RetailSyncData>;
	costcoSync?: Partial<RetailSyncData>;
};

/** Parses saved data, filling in defaults for fields added later. Unknown fields are kept. */
export const WingspanDataSchema: v.GenericSchema<SavedWingspanData, WingspanData> = v.looseObject({
	recurringDueDates: RecurringDueDatesDataSchema,
	recurring: RecurringDataSchema,
	/** Absent until cash and card settings are first saved. */
	cashSettings: v.optional(SavedCashSettingsSchema, emptySavedCashSettings),
	/** Absent until a business's settings are first saved. */
	businessCashSettings: v.optional(v.record(v.string(), SavedCashSettingsSchema), () => ({})),
	/** Absent until Walmart is first synced. */
	walmartSync: v.optional(RetailSyncDataSchema, emptyRetailSyncData),
	/** Absent until Costco is first synced. */
	costcoSync: v.optional(RetailSyncDataSchema, emptyRetailSyncData)
});

export const emptyWingspanData = (): WingspanData => ({
	recurringDueDates: emptyRecurringDueDatesData(),
	recurring: emptyRecurringData(),
	cashSettings: emptySavedCashSettings(),
	businessCashSettings: {},
	walmartSync: emptyRetailSyncData(),
	costcoSync: emptyRetailSyncData()
});

/** Whether the household saved anything worth keeping: recurring items, due dates or cash settings. Retail sync history alone doesn't count. */
export const hasWingspanData = (data: WingspanData): boolean =>
	data.recurring.recurringItems.length > 0 ||
	Object.keys(data.recurringDueDates.dueDatesByRecurrenceId).length > 0 ||
	hasChosenCashSettings(data.cashSettings) ||
	Object.values(data.businessCashSettings).some(hasChosenCashSettings);

type PickValue = <TValue>(theirs: TValue | undefined, ours: TValue | undefined, base: TValue | undefined) => TValue | undefined;

/**
 * Merges both copies. With `base` (the last version both agreed on), each item, due day and entity's cash settings
 * come from whichever side changed them, preferring ours when both did, so the other side's edits and removals aren't
 * undone. Without a base, e.g. when this browser is new to the account, it's the union of both, with ours winning by id.
 */
export const mergeWingspanData = (theirs: WingspanData, ours: WingspanData, base?: WingspanData): WingspanData =>
	base ? combine(theirs, ours, base, pickChanged) : combine(theirs, ours, undefined, (theirValue, ourValue) => ourValue ?? theirValue);

function combine(theirs: WingspanData, ours: WingspanData, base: WingspanData | undefined, pick: PickValue): WingspanData {
	const earliestTrackingMonth = [theirs.recurring.trackingSince, ours.recurring.trackingSince].filter(month => month !== '').sort()[0] ?? '';
	const itemsById = (data: WingspanData | undefined) => new Map((data?.recurring.recurringItems ?? []).map(item => [item.id, item]));
	const items = mergeEntries(itemsById(theirs), itemsById(ours), base && itemsById(base), pick);
	const dueDays = (data: WingspanData | undefined) => new Map(Object.entries(data?.recurringDueDates.dueDatesByRecurrenceId ?? {}));
	const dueDatesByRecurrenceId = Object.fromEntries(mergeEntries(dueDays(theirs), dueDays(ours), base && dueDays(base), pick));
	// Settings that were never set aren't kept; the side that set them wins.
	const chosen = (settings: SavedCashSettings) => (hasChosenCashSettings(settings) ? settings : undefined);
	const cashSettings = pick(chosen(theirs.cashSettings), chosen(ours.cashSettings), base && chosen(base.cashSettings));
	const businessSettings = (data: WingspanData | undefined) =>
		new Map(Object.entries(data?.businessCashSettings ?? {}).flatMap(([businessId, settings]) => (hasChosenCashSettings(settings) ? [[businessId, settings] as const] : [])));
	const businessCashSettings = Object.fromEntries(mergeEntries(businessSettings(theirs), businessSettings(ours), base && businessSettings(base), pick));

	return {
		...mergeOtherFields(theirs, ours, base, pick),
		recurring: { ...mergeOtherFields(theirs.recurring, ours.recurring, base?.recurring, pick), trackingSince: earliestTrackingMonth, recurringItems: [...items.values()] },
		recurringDueDates: { ...mergeOtherFields(theirs.recurringDueDates, ours.recurringDueDates, base?.recurringDueDates, pick), dueDatesByRecurrenceId },
		cashSettings: cashSettings ?? theirs.cashSettings ?? emptySavedCashSettings(),
		businessCashSettings,
		walmartSync: mergeRetailSyncData(theirs.walmartSync, ours.walmartSync),
		costcoSync: mergeRetailSyncData(theirs.costcoSync, ours.costcoSync)
	};
}

/** Fields this version doesn't know how to merge, e.g. ones added by a newer version. Each comes from whichever side changed it. */
function mergeOtherFields<TValue extends object>(theirs: TValue, ours: TValue, base: TValue | undefined, pick: PickValue): TValue {
	const [theirFields, ourFields, baseFields] = [theirs, ours, base] as Record<string, unknown>[];
	const keys = new Set([...Object.keys(theirFields as object), ...Object.keys(ourFields as object)]);
	return Object.fromEntries(
		[...keys].flatMap(key => {
			const value = pick(theirFields?.[key], ourFields?.[key], baseFields?.[key]);
			return value === undefined ? [] : [[key, value]];
		})
	) as TValue;
}

/** Theirs, unless ours changed since `base` or theirs didn't. Undefined means removed. */
function pickChanged<TValue>(theirs: TValue | undefined, ours: TValue | undefined, base: TValue | undefined): TValue | undefined {
	if (isSameValue(ours, base)) return theirs;
	if (isSameValue(theirs, base)) return ours;
	return ours ?? theirs;
}

function mergeEntries<TValue>(theirs: Map<string, TValue>, ours: Map<string, TValue>, base: Map<string, TValue> | undefined, pick: PickValue): Map<string, TValue> {
	const merged = new Map<string, TValue>();
	for (const key of new Set([...theirs.keys(), ...ours.keys()])) {
		const value = pick(theirs.get(key), ours.get(key), base?.get(key));
		if (value !== undefined) merged.set(key, value);
	}
	return merged;
}
