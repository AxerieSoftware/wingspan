import * as v from 'valibot';

/** The choices for how many days ahead free cash must still cover the cushion, bills and card payments. */
export const SAFETY_DAY_CHOICES = [30, 60, 90] as const;
/** Used until the household picks one of SAFETY_DAY_CHOICES. */
export const DEFAULT_SAFETY_DAYS = 30;

/** Unset account lists use the defaults: accounts named like checking, every card, and the other cash accounts as reserves. */
export interface SavedCashSettings {
	checkingAccountIds?: string[];
	cardAccountIds?: string[];
	/** Every card that existed when the cards were chosen, so a card added to Monarch later is counted until it's turned off. */
	knownCardAccountIds?: string[];
	reserveAccountIds?: string[];
	cushion: number;
	safetyDays?: number;
}

/** Keeps unknown fields, so settings saved by a newer Wingspan aren't lost. The cushion can't be below $0. */
export const SavedCashSettingsSchema: v.GenericSchema<SavedCashSettings> = v.looseObject({
	checkingAccountIds: v.optional(v.array(v.string())),
	cardAccountIds: v.optional(v.array(v.string())),
	knownCardAccountIds: v.optional(v.array(v.string())),
	reserveAccountIds: v.optional(v.array(v.string())),
	cushion: v.pipe(v.number(), v.minValue(0)),
	safetyDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)))
});

/** Nothing chosen: every list uses its default and the cushion is $0. */
export const emptySavedCashSettings = (): SavedCashSettings => ({ cushion: 0 });

/** Whether the household has set anything, so its settings take priority over defaults when copies are merged. */
export const hasChosenCashSettings = (settings: SavedCashSettings): boolean => settings.cushion !== 0 || Object.entries(settings).some(([key, value]) => key !== 'cushion' && value !== undefined);
