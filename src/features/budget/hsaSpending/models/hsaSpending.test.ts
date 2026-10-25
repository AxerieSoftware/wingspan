import { describe, expect, it } from 'vitest';
import { HsaSpending } from './hsaSpending';

// Invariant: amounts add up exactly, by category and across a group's categories.
describe("a month's HSA spending by Budget row", () => {
	it('adds spending on HSA accounts to tagged expenses, category by category, to the cent', () => {
		const spending = new HsaSpending(
			new Map([
				['medical', 64.3],
				['dental', 0.1]
			]),
			new Map([
				['medical', 185.25],
				['dental', 0.2]
			])
		);

		expect(spending.amountFor(['medical'])).toBe(249.55);
		expect(spending.amountFor(['dental'])).toBe(0.3);
		expect(spending.amountFor(['medical', 'dental', 'groceries'])).toBe(249.85);
	});

	it('is $0 for a row with no HSA spending', () => {
		expect(new HsaSpending(new Map()).amountFor(['groceries'])).toBe(0);
	});
});
