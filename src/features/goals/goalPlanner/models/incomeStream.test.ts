import { describe, expect, it } from 'vitest';
import type { FlowKind, ProjectedDay } from '../../../cashFlow/projectedBalances/models/projection';
import { incomeMonthsOf, incomeStreamsOf } from './incomeStream';

const day = (date: string, ...flows: [number, FlowKind, string][]) => ({ date, flows: flows.map(([amount, kind, label]) => ({ date, amount, kind, label })) }) as unknown as ProjectedDay;

describe("each income's monthly amount", () => {
	// Invariant: like the monthly surplus, a year of payments after today is scaled to an average month.
	it('totals each income by name after today, scaled to a month, largest first, leaving out bills and everything else', () => {
		const days = [
			day('2026-10-24', [3200, 'income', 'Kylie Paycheck']),
			day('2026-11-01', [3600, 'income', 'Kylie Paycheck'], [-1500, 'bill', 'Rent']),
			day('2026-11-15', [5562, 'income', 'Andrew Paycheck'], [250, 'draw', 'From savings'])
		];

		const streams = incomeStreamsOf(days, '2026-10-24');

		expect(streams.map(stream => stream.name)).toEqual(['Andrew Paycheck', 'Kylie Paycheck']);
		expect(streams[1]?.monthly).toBeCloseTo((3600 * 365) / 12 / 365, 9);
	});
});

describe('income in a normal month', () => {
	// Invariant: a normal month is the median whole month, below the average by the average less that median, to the cent.
	it('is two biweekly paychecks, with a month of three shown on its own', () => {
		const paydays = Array.from({ length: 26 }, (_, index) =>
			Temporal.PlainDate.from('2026-10-30')
				.add({ days: 14 * index })
				.toString()
		);
		const days = [day('2026-10-25'), ...paydays.map(date => day(date, [2000, 'income', 'Paycheck'])), day('2027-10-25')];

		expect(incomeMonthsOf(days, '2026-10-25', incomeStreamsOf(days, '2026-10-25'))).toEqual({ belowAverage: 333.33, extraMonths: { count: 1, eachAbout: 2000 } });
	});
});
