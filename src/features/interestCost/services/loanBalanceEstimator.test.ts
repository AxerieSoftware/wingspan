import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../common/calendar';
import { LoanBalanceEstimator } from './loanBalanceEstimator';

const estimator = new LoanBalanceEstimator(new Calendar(() => Temporal.PlainDate.from('2026-10-11')));

describe('estimated loan balance', () => {
	it('adds simple daily interest since the balance was entered and takes off the payments since', () => {
		const estimate = estimator.estimate({ owed: 52000.4, rate: 4.25, balanceDate: '2026-09-11', payments: [610] });

		const interest = (52000.4 * 0.0425 * 30) / 365;
		expect(estimate).toBe(Math.round((52000.4 + interest - 610) * 100) / 100);
		expect(estimate).toBe(51572.05);
	});

	it('only adds interest when nothing was paid', () => {
		expect(estimator.estimate({ owed: 14300.6, rate: 6.1, balanceDate: '2026-10-01', payments: [] })).toBe(14324.5);
	});

	it('is what was entered when it was entered today', () => {
		expect(estimator.estimate({ owed: 1000, rate: 5, balanceDate: '2026-10-11', payments: [] })).toBe(1000);
	});

	it("doesn't go below $0 when a payoff covers more than was owed", () => {
		expect(estimator.estimate({ owed: 425.1, rate: 4.2, balanceDate: '2026-04-01', payments: [500] })).toBe(0);
	});
});
