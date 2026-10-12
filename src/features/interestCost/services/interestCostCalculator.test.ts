import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../common/calendar';
import type { Account } from '../../../monarch/api/models/account';
import type { Transaction } from '../../../monarch/api/models/transaction';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from '../../businessEntities/models/entityScope';
import { InterestCostCalculator } from './interestCostCalculator';

const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-11'));
const calculator = new InterestCostCalculator(calendar);
const everything = EntityScope.everything([{ id: 'biz-contoso' }]);

const loan = (id: string, owed: number, interestRate: number | null, extra: Partial<Account> = {}): Account => ({
	id,
	displayName: id,
	currentBalance: -owed,
	isAsset: false,
	isHidden: false,
	type: { name: 'loan', display: 'Loans' },
	interestRate,
	...extra
});
const card = (id: string, owed: number, apr: number | null): Account => ({
	id,
	displayName: id,
	currentBalance: -owed,
	isAsset: false,
	isHidden: false,
	type: { name: 'credit', display: 'Credit Cards' },
	apr
});
const interestCharge = (accountId: string, date: string, amount: number) =>
	({ id: `tx-${accountId}-${date}`, date, amount: -amount, accountId, description: 'INTEREST CHARGE ON PURCHASES' }) as Transaction;
const owedOf = (accounts: Account[]) => Object.fromEntries(accounts.map(account => [account.id, -(account.currentBalance ?? 0)]));

describe('interest cost', () => {
	it("is each loan's balance times its rate a year, a 365th of that a day and a 12th a month", () => {
		const accounts = [loan('Direct loan', 52000.4, 4.25), loan('Parent loan', 14300.6, 6.1)];

		const cost = calculator.calculate({ accounts, transactions: [], owedByAccountId: owedOf(accounts) }, everything);

		const yearly = (52000.4 * 4.25) / 100 + (14300.6 * 6.1) / 100;
		expect(cost.yearly).toBeCloseTo(yearly, 8);
		expect(cost.daily).toBeCloseTo(yearly / 365, 8);
		expect(cost.monthly).toBeCloseTo(yearly / 12, 8);
		expect(cost.daily * 365).toBeCloseTo(cost.monthly * 12, 8);
	});

	it('totals exactly the sum of each debt', () => {
		const accounts = [loan('First', 1000.01, 3.75), loan('Second', 2500.5, 6.8), card('Card', 412.8, 22.9)];
		const transactions = [interestCharge('Card', '2026-09-20', 7.75)];

		const cost = calculator.calculate({ accounts, transactions, owedByAccountId: owedOf(accounts) }, everything);

		// $1,000.01 at 3.75%, $2,500.50 at 6.8% and the card's $412.80 at 22.9%.
		expect(cost.inGroup('Loans').yearly).toBeCloseTo(37.500375 + 170.034, 10);
		expect(cost.inGroup('Credit Cards').yearly).toBeCloseTo(94.5312, 10);
		expect(cost.yearly).toBeCloseTo(302.065575, 10);
	});

	it('leaves out loans with no rate in Monarch and loans paid off', () => {
		const accounts = [loan('No rate', 5000, null), loan('Paid off', 0, 4.5), loan('Counted', 1000, 5)];

		const cost = calculator.calculate({ accounts, transactions: [], owedByAccountId: owedOf(accounts) }, everything);

		expect(cost.debts.map(debt => debt.name)).toEqual(['Counted']);
	});

	it('counts a card only while it was charged interest in about the last two statements, since a card paid in full costs none', () => {
		const accounts = [card('Carried', 1200, 24), card('Paid in full', 800, 24), card('Charged long ago', 600, 24)];
		const transactions = [interestCharge('Carried', '2026-09-28', 23.5), interestCharge('Charged long ago', '2026-07-01', 10)];

		const cost = calculator.calculate({ accounts, transactions, owedByAccountId: owedOf(accounts) }, everything);

		expect(cost.debts.map(debt => debt.name)).toEqual(['Carried']);
		expect(cost.yearly).toBeCloseTo(288, 10);
	});

	it('gives a card without an APR the rate its last interest charge implies, at most 36%', () => {
		const accounts = [card('No APR', 1000, null), card('Paid down', 100, null)];
		const transactions = [interestCharge('No APR', '2026-10-01', 20), interestCharge('Paid down', '2026-10-01', 20)];

		const cost = calculator.calculate({ accounts, transactions, owedByAccountId: owedOf(accounts) }, everything);

		expect(cost.debts).toMatchObject([
			{ name: 'No APR', rate: 24, isRateImplied: true },
			{ name: 'Paid down', rate: 36, isRateImplied: true }
		]);
	});

	it('counts only the debts of the entities shown, and none hidden', () => {
		const accounts = [loan('Household loan', 1000, 5), loan('Business loan', 2000, 5, { businessEntity: { id: 'biz-contoso' } }), loan('Hidden loan', 3000, 5, { isHidden: true })];

		const cost = calculator.calculate({ accounts, transactions: [], owedByAccountId: owedOf(accounts) }, EntityScope.fromFilter([HOUSEHOLD_ENTITY_ID], [{ id: 'biz-contoso' }]));

		expect(cost.debts.map(debt => debt.name)).toEqual(['Household loan']);
	});
});
