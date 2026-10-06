export type ScheduleUnit = 'week' | 'month' | 'year';

/** A recurrence as the editor shows it. `monthDay` or `twiceMonthlyDays` set a monthly one's days. */
export interface Schedule {
	every: number;
	unit: ScheduleUnit;
	start: string;
	monthDay?: number;
	twiceMonthlyDays?: [number, number];
}

/** A choice in the Frequency field. */
export interface SchedulePreset {
	key: string;
	label: string;
	every: number;
	unit: ScheduleUnit;
	twiceMonthly?: boolean;
}

/** The Frequency field's choices, in order. */
export const SCHEDULE_PRESETS: SchedulePreset[] = [
	{ key: 'week', label: 'Weekly', every: 1, unit: 'week' },
	{ key: '2week', label: 'Biweekly', every: 2, unit: 'week' },
	{ key: 'twice', label: 'Twice a month', every: 1, unit: 'month', twiceMonthly: true },
	{ key: 'month', label: 'Monthly', every: 1, unit: 'month' },
	{ key: '2month', label: 'Every 2 months', every: 2, unit: 'month' },
	{ key: '3month', label: 'Quarterly', every: 3, unit: 'month' },
	{ key: '6month', label: 'Every 6 months', every: 6, unit: 'month' },
	{ key: 'year', label: 'Yearly', every: 1, unit: 'year' }
];

/** The Frequency choice for a schedule no preset matches. */
export const CUSTOM_PRESET_KEY = 'custom';
