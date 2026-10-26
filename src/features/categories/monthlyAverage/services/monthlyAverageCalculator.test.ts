import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { MonthlyAverageCalculator } from './monthlyAverageCalculator';

const calculator = new MonthlyAverageCalculator(new Calendar(() => Temporal.PlainDate.from('2026-10-24')));

// Invariant: the average times the months covered is exactly the total Monarch shows.
describe("a category's average per month on its Summary", () => {
	it('spreads a past year over its 12 months and a past quarter over its 3', () => {
		expect(calculator.average(1395.92, { kind: 'year', startDate: '2025-01-01' }, '2025-01-09')).toBeCloseTo(1395.92 / 12, 9);
		expect(calculator.average(300, { kind: 'quarter', startDate: '2026-04-01' }, '2026-04-17')).toBe(100);
	});

	it('spreads this year over its months so far, October included', () => {
		expect(calculator.average(1000, { kind: 'year', startDate: '2026-01-01' }, '2026-01-16')).toBe(100);
	});

	it('spreads all time from the month of the first transaction through this month', () => {
		expect(calculator.average(3603.69, null, '2024-05-01')).toBeCloseTo(3603.69 / 30, 9);
	});

	it("isn't shown for a picked month, week or day", () => {
		expect(calculator.average(140, { kind: 'month', startDate: '2026-09-01' }, '2026-09-16')).toBeNull();
		expect(calculator.average(40, { kind: 'week', startDate: '2026-09-14' }, '2026-09-16')).toBeNull();
	});
});
