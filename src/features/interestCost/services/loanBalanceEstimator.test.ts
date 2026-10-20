import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../common/calendar';
import { LoanBalanceEstimator } from './loanBalanceEstimator';

const estimator = new LoanBalanceEstimator(new Calendar(() => Temporal.PlainDate.from('2026-10-11')));

// Invariant: interest accrues only on the principal still owed, and each payment covers the interest built up before
// the principal, so the estimate is what a simple-interest servicer would show.
describe('estimated loan balance', () => {
	it('adds simple daily interest since the balance was entered and takes off the payments since', () => {
		const estimate = estimator.estimate({ owed: 52000.4, rate: 4.25, balanceDate: '2026-09-11', payments: [{ date: '2026-10-11', amount: 610 }] });

		const interest = (52000.4 * 0.0425 * 30) / 365;
		expect(estimate).toBe(Math.round((52000.4 + interest - 610) * 100) / 100);
		expect(estimate).toBe(51572.05);
	});

	it('charges interest after a payment on the lower principal, not the balance as entered', () => {
		const estimate = estimator.estimate({ owed: 20000, rate: 6, balanceDate: '2026-04-14', payments: [{ date: '2026-07-13', amount: 5000 }] });

		const beforePayment = (20000 * 0.06 * 90) / 365;
		const principalAfter = 20000 - (5000 - beforePayment);
		const afterPayment = (principalAfter * 0.06 * 90) / 365;
		expect(estimate).toBe(Math.round((principalAfter + afterPayment) * 100) / 100);
		expect(estimate).toBeLessThan(Math.round((20000 + (20000 * 0.06 * 180) / 365 - 5000) * 100) / 100);
	});

	it('applies payments in date order, whatever order they arrive in', () => {
		const payments = [
			{ date: '2026-09-15', amount: 400 },
			{ date: '2026-08-15', amount: 400 }
		];

		expect(estimator.estimate({ owed: 9000, rate: 5, balanceDate: '2026-07-15', payments })).toBe(
			estimator.estimate({ owed: 9000, rate: 5, balanceDate: '2026-07-15', payments: payments.toReversed() })
		);
	});

	it('only adds interest when nothing was paid', () => {
		expect(estimator.estimate({ owed: 14300.6, rate: 6.1, balanceDate: '2026-10-01', payments: [] })).toBe(14324.5);
	});

	it('is what was owed minus payments for a loan without interest', () => {
		expect(estimator.estimate({ owed: 10000, rate: 0, balanceDate: '2026-09-01', payments: [{ date: '2026-10-01', amount: 500 }] })).toBe(9500);
	});

	it('is what was entered when it was entered today', () => {
		expect(estimator.estimate({ owed: 1000, rate: 5, balanceDate: '2026-10-11', payments: [] })).toBe(1000);
	});

	it("doesn't go below $0 when a payoff covers more than was owed", () => {
		expect(estimator.estimate({ owed: 425.1, rate: 4.2, balanceDate: '2026-04-01', payments: [{ date: '2026-05-01', amount: 500 }] })).toBe(0);
	});
});
