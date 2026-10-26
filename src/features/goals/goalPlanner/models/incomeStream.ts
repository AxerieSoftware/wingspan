import { CENTS_PER_DOLLAR, DAYS_PER_YEAR, MONTHS_PER_YEAR, toCents } from '../../../../common/money';
import { median } from '../../../../common/statistics';
import type { ProjectedDay } from '../../../cashFlow/projectedBalances/models/projection';
import { PROJECTED_DAYS } from '../../../cashFlow/projectedBalances/models/projectionHorizon';
import { type ExtraMonths, extraMonthsOf } from './goalRoom';

/** A recurring income, like a paycheck, and what it brings in a month. */
export interface IncomeStream {
	name: string;
	monthly: number;
}

/**
 * Each income in the projection's year ahead, by name, largest first. Counted as the monthly surplus counts income:
 * every payment after today, scaled from the projected days to a month.
 *
 * Invariant: the streams' monthly amounts add up, to the cent, to the income the monthly surplus counts.
 */
export function incomeStreamsOf(days: readonly ProjectedDay[], today: string): IncomeStream[] {
	const centsByName = new Map<string, number>();
	for (const day of days) {
		if (day.date <= today) continue;
		for (const flow of day.flows) {
			if (flow.kind === 'income') centsByName.set(flow.label, (centsByName.get(flow.label) ?? 0) + toCents(flow.amount));
		}
	}
	return [...centsByName].map(([name, cents]) => ({ name, monthly: (cents * DAYS_PER_YEAR) / MONTHS_PER_YEAR / PROJECTED_DAYS / CENTS_PER_DOLLAR })).sort((a, b) => b.monthly - a.monthly);
}

/** Income in a normal month of the projection's year, and the months that bring in more, as with a third paycheck. */
export interface IncomeMonths {
	/** How much less a normal month brings in than the average month the monthly surplus counts. */
	belowAverage: number;
	extraMonths: ExtraMonths | null;
}

/**
 * Income by calendar month, from the whole months after today's, against the average month `streams` add up to. A normal month is their median, and months an extra
 * paycheck's worth above it are the extra ones. Null without a whole month of income.
 *
 * Invariant, in whole cents: belowAverage is the streams' monthly amounts added up, less the median month.
 */
export function incomeMonthsOf(days: readonly ProjectedDay[], today: string, streams: readonly IncomeStream[]): IncomeMonths | null {
	const centsByMonth = new Map<string, number>();
	for (const day of days) {
		if (day.date <= today) continue;
		const income = day.flows.reduce((total, flow) => total + (flow.kind === 'income' ? toCents(flow.amount) : 0), 0);
		const month = day.date.slice(0, 7);
		centsByMonth.set(month, (centsByMonth.get(month) ?? 0) + income);
	}
	// Today's month is cut short, and so is the last one unless the projection runs to its end.
	const lastDate = days.at(-1)?.date ?? today;
	const isWhole = (month: string) => month > today.slice(0, 7) && Temporal.PlainYearMonth.from(month).toPlainDate({ day: 31 }).toString() <= lastDate;
	const wholeMonths = [...centsByMonth].filter(([month]) => isWhole(month)).map(([, cents]) => cents);
	if (!wholeMonths.length) return null;
	const normalCents = Math.round(median(wholeMonths));
	const averageCents = streams.reduce((total, stream) => total + toCents(stream.monthly), 0);
	const extraMonths = extraMonthsOf(
		wholeMonths.map(cents => ({ incomeCents: cents, extraCents: cents - normalCents })),
		normalCents
	);
	return { belowAverage: (averageCents - normalCents) / CENTS_PER_DOLLAR, extraMonths };
}
