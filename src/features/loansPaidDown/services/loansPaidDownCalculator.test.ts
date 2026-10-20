import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../common/calendar';
import type { LoanBalances } from '../../../monarch/api/models/loanBalances';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from '../../businessEntities/models/entityScope';
import { LoanBalanceEstimator } from '../../interestCost/services/loanBalanceEstimator';
import { LoansPaidDownCalculator } from './loansPaidDownCalculator';

const calculator = new LoansPaidDownCalculator(new LoanBalanceEstimator(new Calendar(() => Temporal.PlainDate.from('2026-10-19'))));
const everything = EntityScope.everything([{ id: 'biz-contoso' }]);

const loan = (name: string, startBalance: number | null, endBalance: number | null, extra: Partial<LoanBalances> = {}): LoanBalances => ({
	accountId: `acct-${name}`,
	displayName: name,
	businessEntity: null,
	startBalance,
	endBalance,
	currentBalance: endBalance ?? 0,
	isManual: false,
	interestRate: null,
	...extra
});

describe('debt paydown', () => {
	it('is what the loans owed at the start minus what they owe at the end', () => {
		const paydown = calculator.calculate([loan('Parent loan', -21400.5, -15820.25), loan('Car loan', -9800, -9120)], 10000, everything, null);

		expect(paydown?.amount).toBe(6260.25);
		expect(paydown?.loans).toEqual([
			{ name: 'Parent loan', amount: 5580.25, isFromPayments: false },
			{ name: 'Car loan', amount: 680, isFromPayments: false }
		]);
	});

	it('totals exactly the sum of each loan, to the cent, without float error', () => {
		const loans = [loan('First', -100.1, -0.2), loan('Second', -0.3, -0.1), loan('Third', -12345.1, -11809.16), loan('Fourth', -30100.84, -30485.11)];

		const paydown = calculator.calculate(loans, 1, everything, null);

		const sumOfLoansInCents = paydown?.loans.reduce((total, each) => total + Math.round(each.amount * 100), 0);
		expect(Math.round((paydown?.amount ?? 0) * 100)).toBe(sumOfLoansInCents);
		expect(paydown?.amount).toBe(251.77);
	});

	it('is negative when interest grew a loan by more than was paid', () => {
		const paydown = calculator.calculate([loan('Direct loan', -30100.84, -30485.11)], 5000, everything, null);

		expect(paydown?.amount).toBe(-384.27);
	});

	it('counts a loan closed during the period down to its current balance, since Monarch has no balance for it after it closed', () => {
		const paydown = calculator.calculate([loan('Paid-off auto loan', -1250.4, null, { currentBalance: 0 })], 5000, everything, null);

		expect(paydown?.amount).toBe(1250.4);
	});

	it('leaves out a loan with no balance at the start, so a loan added during the period is not counted as new debt', () => {
		const paydown = calculator.calculate([loan('Older loan', -1000, -900), loan('Added loan', null, -20000)], 5000, everything, null);

		expect(paydown?.amount).toBe(100);
		expect(paydown?.loans.map(each => each.name)).toEqual(['Older loan']);
	});

	it('is null when no loan had a balance at the start', () => {
		expect(calculator.calculate([loan('Paid off long ago', null, null)], 5000, everything, null)).toBeNull();
		expect(calculator.calculate([], 5000, everything, null)).toBeNull();
	});

	it('counts only the loans of the entities shown', () => {
		const loans = [loan('Household loan', -1000, -900), loan('Business loan', -5000, -4000, { businessEntity: { id: 'biz-contoso' } })];

		const household = calculator.calculate(loans, 5000, EntityScope.fromFilter([HOUSEHOLD_ENTITY_ID], [{ id: 'biz-contoso' }]), null);
		const business = calculator.calculate(loans, 5000, EntityScope.fromFilter(['biz-contoso'], [{ id: 'biz-contoso' }]), null);

		expect(household?.amount).toBe(100);
		expect(business?.amount).toBe(1000);
	});

	it("is a share of the period's income, or none without income", () => {
		expect(calculator.calculate([loan('Loan', -1000, -900)], 4000, everything, null)?.shareOfIncome).toBe(0.025);
		expect(calculator.calculate([loan('Loan', -1000, -900)], 0, everything, null)?.shareOfIncome).toBeNull();
	});

	// Invariant: a manual loan with a linked payment goes down by exactly its payments in the period minus the simple
	// interest on what it owed, however late its balance was entered.
	it("counts a linked manual loan's payments minus interest, not the balances entered for it", () => {
		const manual = loan('Direct loan', -20000, -18000, { isManual: true, interestRate: 3.65 });
		const payments = new Map([
			[
				manual.accountId,
				[
					{ date: '2026-09-15', amount: 400 },
					{ date: '2026-10-15', amount: 400 }
				]
			]
		]);

		const paydown = calculator.calculate([manual, loan('Car loan', -9800, -9120)], 5000, everything, { balanceStartDate: '2026-09-30', throughDate: '2026-10-19', paymentsByLoanId: payments });

		const interestBeforePayment = (20000 * 0.0365 * 15) / 365;
		const principalAfter = 20000 - (400 - interestBeforePayment);
		const interestAfterPayment = (principalAfter * 0.0365 * 4) / 365;
		const expected = Math.round((20000 - (principalAfter + interestAfterPayment)) * 100) / 100;
		expect(paydown?.loans).toEqual([
			{ name: 'Car loan', amount: 680, isFromPayments: false },
			{ name: 'Direct loan', amount: expected, isFromPayments: true }
		]);
		expect(paydown?.amount).toBe(Math.round((680 + expected) * 100) / 100);
	});

	it("uses a manual loan's balances when its payments aren't linked or Monarch's transactions don't reach the period's start", () => {
		const manual = loan('Direct loan', -20000, -18000, { isManual: true, interestRate: 3.65 });
		const unlinked = { balanceStartDate: '2026-09-30', throughDate: '2026-10-19', paymentsByLoanId: new Map() };

		expect(calculator.calculate([manual], 5000, everything, unlinked)?.loans).toEqual([{ name: 'Direct loan', amount: 2000, isFromPayments: false }]);
		expect(calculator.calculate([manual], 5000, everything, null)?.amount).toBe(2000);
	});
});
