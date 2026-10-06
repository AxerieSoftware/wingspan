import { describe, expect, it } from 'vitest';
import { MinimumPaymentEstimator } from './minimumPaymentEstimator';

const estimator = new MinimumPaymentEstimator();

describe('minimum payment estimate', () => {
	it("is 1% of the statement balance plus a month's interest, rounded down to the dollar", () => {
		expect(estimator.estimate(4000, 24)).toBe(Math.floor(4000 * 0.01 + 4000 * 0.02));
	});

	it('is at least $35', () => {
		expect(estimator.estimate(500, 24)).toBe(35);
	});

	it('is 2% of the balance without an APR', () => {
		expect(estimator.estimate(5000, null)).toBe(100);
	});

	it('rounds down to the dollar without float error moving it either way', () => {
		expect(estimator.estimate(2099.85, null)).toBe(41);
		expect(estimator.estimate(1200, 30)).toBe(42);
		expect(estimator.estimate(10000, 30)).toBe(350);
	});

	it('is $0 when nothing is owed', () => {
		expect(estimator.estimate(0, 24)).toBe(0);
	});
});
