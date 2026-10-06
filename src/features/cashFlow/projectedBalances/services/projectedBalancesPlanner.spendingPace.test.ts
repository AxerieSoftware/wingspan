import { describe, expect, it } from 'vitest';
import type { RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import { account, CARD, CHECKING, input, plannerFor, recurringFlow, SIX_MONTHS, spent } from './projectedBalancesPlanner.fixtures';

describe('spending pace', () => {
	it('is the median of the last three completed months, with months that spent nothing counting as zero', () => {
		// June is past the three months; August spent nothing; October is this month, not yet complete.
		const transactions = [spent('2026-06-10', 900), spent('2026-07-10', 200), spent('2026-09-10', 400), spent('2026-10-01', 9999)];

		const { pace } = plannerFor().plan(input({ transactions }));

		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(200);
	});

	it("leaves out recurring items, income, transfers, hidden transactions and Wingspan's matched payments, and nets refunds", () => {
		const transactions = SIX_MONTHS.flatMap(month => [
			spent(`${month}-05`, 100),
			spent(`${month}-06`, -20),
			spent(`${month}-07`, 1450, CHECKING, { isRecurring: true }),
			spent(`${month}-08`, -3200, CHECKING, { category: { id: 'pay', name: 'Paychecks', icon: null, groupType: 'income' } }),
			spent(`${month}-09`, 500, CHECKING, { category: { id: 'card', name: 'Credit Card Payment', icon: null, groupType: 'transfer' } }),
			spent(`${month}-10`, 70, CHECKING, { hideFromReports: true }),
			spent(`${month}-11`, 140, CHECKING, { id: `lesson-${month}` })
		]);

		const { pace } = plannerFor().plan(input({ transactions, itemTransactionIds: new Set(SIX_MONTHS.map(month => `lesson-${month}`)) }));

		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(80);
	});

	it("doesn't use one large purchase on a long-unused card as its pace when the household has full months", () => {
		const transactions = [...SIX_MONTHS.map(month => spent(`${month}-10`, 300)), spent('2026-10-01', 1000, CARD)];

		const { pace } = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -1000)], transactions }));

		expect(pace.monthlyByAccountId.get(CARD) ?? 0).toBe(0);
	});

	it('leaves out only the recurring payment each month, not other purchases near its amount at the same merchant', () => {
		// A $65 membership renews on the 5th; groceries there run about the same.
		const transactions = SIX_MONTHS.flatMap(month => [
			spent(`${month}-05`, 65, CARD, { merchantId: 'warehouse' }),
			...[8, 15, 22, 29].map(day => spent(`${month}-${day}`, 80, CARD, { merchantId: 'warehouse' }))
		]);
		const membership = recurringFlow('Membership', 'expense', '2026-11-05', -65, CARD, 'warehouse');
		const recurringFlows = [{ ...membership, occurrences: SIX_MONTHS.map(month => ({ date: `${month}-05`, status: 'paid', amount: -65, account: { id: CARD } })) }];

		const { pace } = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -100)], transactions, recurringFlows }));

		expect(pace.monthlyByAccountId.get(CARD)).toBe(320);
	});

	it('keeps purchases at a merchant that only recurs on another account, like a store a business also buys from', () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 60, CHECKING, { merchantId: 'store' }));
		const recurringFlows = [recurringFlow('Supplies', 'expense', '2026-11-10', -50, 'businessCard', 'store')];

		const { pace } = plannerFor().plan(input({ transactions, recurringFlows }));

		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(60);
	});

	it("leaves out payments to Monarch's recurring merchants near their recurring amount, but not other purchases there", () => {
		const transactions = SIX_MONTHS.flatMap(month => [spent(`${month}-02`, 1450, CHECKING, { merchantId: 'landlord' }), spent(`${month}-20`, 90, CHECKING, { merchantId: 'landlord' })]);
		const rent = recurringFlow('Rent', 'expense', '2026-11-02', -1450, CHECKING, 'landlord');
		const recurringFlows = [{ ...rent, occurrences: SIX_MONTHS.map(month => ({ date: `${month}-02`, status: 'paid', amount: -1450, account: { id: CHECKING } })) }];

		const { pace } = plannerFor().plan(input({ transactions, recurringFlows }));

		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(90);
	});

	it('uses only the full months since the first transaction', () => {
		const transactions = [spent('2026-08-03', 300), spent('2026-09-03', 500)];

		const { pace } = plannerFor().plan(input({ transactions }));

		// August only has data from the 3rd, so it's left out instead of understating spending.
		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(500);
	});

	it('measures an account opened partway through on its own full months, leaving out its first partial month', () => {
		const transactions = [...SIX_MONTHS.map(month => spent(`${month}-10`, 100)), spent('2026-08-12', 50, CARD), spent('2026-09-12', 300, CARD)];

		const { pace } = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 5000), account(CARD, 'credit', 0)], transactions }));

		// August is the card's first, partial month; September is its only full one.
		expect(pace.monthlyByAccountId.get(CARD)).toBe(300);
	});

	it("leaves Monarch's recurring merchants in everyday spending when Monarch has no amount for them", () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 80, CHECKING, { merchantId: 'market' }));
		const noAmount: RecurringFlow = {
			recurrenceGroup: { id: 'Market', name: 'Market', recurringType: 'expense', amount: null, account: { id: CHECKING }, merchant: { id: 'market' } },
			occurrences: []
		};

		const { pace } = plannerFor().plan(input({ transactions, recurringFlows: [noAmount] }));

		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(80);
	});
});
