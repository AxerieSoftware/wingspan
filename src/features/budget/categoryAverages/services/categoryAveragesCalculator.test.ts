import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { CategoryAveragesCalculator } from './categoryAveragesCalculator';

const calculatorOn = (today: string) => new CategoryAveragesCalculator(new Calendar(() => Temporal.PlainDate.from(today)));
const total = (month: string, amount: number, categoryId = 'groceries') => ({ categoryId, month, amount });

describe('averaging a category over recent months', () => {
	it('reads from the start of the month a year back through the end of this one', () => {
		expect(calculatorOn('2026-10-24').dates()).toEqual({ startDate: '2025-10-01', endDate: '2026-10-31' });
	});

	// Invariant: each average times its month count is exactly the total of those months, with empty months as $0.
	it('averages only full months before this one, counting months with nothing as $0 and ignoring other categories', () => {
		const totals = [
			total('2026-10', 999),
			total('2026-09', 300),
			total('2026-08', 150.3),
			total('2026-06', 90),
			total('2026-01', 60),
			total('2025-10', 1200),
			total('2025-09', 5000),
			total('2026-09', 70, 'gas')
		];

		const averages = calculatorOn('2026-10-24').averages('groceries', totals);

		expect(averages.threeMonths * 3).toBeCloseTo(300 + 150.3, 9);
		expect(averages.twelveMonths * 12).toBeCloseTo(300 + 150.3 + 90 + 60 + 1200, 9);
		expect((averages.yearToDate ?? 0) * 9).toBeCloseTo(300 + 150.3 + 90 + 60, 9);
	});

	// Invariant: this year's total is exactly the sum of its months, this one included.
	it('totals this year so far, this month included, and nothing from last year', () => {
		const totals = [total('2026-10', 45.5), total('2026-09', 300), total('2026-01', 60), total('2025-12', 1200)];

		expect(calculatorOn('2026-10-24').averages('groceries', totals).thisYear).toBeCloseTo(405.5, 9);
		expect(calculatorOn('2027-01-15').averages('groceries', [total('2027-01', 20), total('2026-12', 100)]).thisYear).toBe(20);
	});

	it('keeps refunds that bring a month below $0', () => {
		expect(calculatorOn('2026-04-02').averages('groceries', [total('2026-03', -30), total('2026-02', 90), total('2026-01', 0)]).threeMonths).toBe(20);
	});

	it('has no year-to-date average in January, before any full month this year', () => {
		expect(calculatorOn('2027-01-15').averages('groceries', [total('2026-12', 100)]).yearToDate).toBeNull();
	});
});
