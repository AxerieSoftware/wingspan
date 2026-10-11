import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../../recurring/recurringItems/models/occurrence';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import { account, CHECKING, input, plannerFor, spent, TODAY } from './projectedBalancesPlanner.fixtures';

// Invariant: an expected income adds exactly its amount on each due date from today on, and nothing for earlier ones.
// Deposits already received are in the balance, so they never reduce a later due date.
describe('expected income', () => {
	const SAVINGS = 'savings';
	const payouts: RecurringItem = {
		id: 'payouts',
		kind: 'income',
		name: 'Fabrikam Payouts',
		// Weekly on Fridays; TODAY is a Friday.
		recurrence: 'DTSTART:20260904T000000Z\nRRULE:FREQ=WEEKLY',
		amount: 430,
		active: true,
		since: '2026-09',
		matchRule: { matchText: 'Fabrikam', accountId: CHECKING }
	};
	const occurrenceToday = (paid: boolean): Occurrence => ({
		item: payouts,
		dueDate: TODAY,
		key: `payouts@${TODAY}`,
		amount: paid ? 145.22 : 430,
		paid,
		matchedTransaction: paid ? { ...spent(TODAY, -145.22), description: 'Fabrikam transfer' } : null,
		carried: false,
		overdue: false
	});
	const incomeFlows = (items: RecurringItem[], outstandingOccurrences: Occurrence[] = []) =>
		plannerFor()
			.plan(input({ recurringItems: items, outstandingOccurrences }))
			.days.flatMap(day => day.flows.filter(flow => flow.label === payouts.name).map(flow => ({ date: day.date, amount: flow.amount, kind: flow.kind })));

	it('adds its amount on today and each later due date while today has nothing received', () => {
		const flows = incomeFlows([payouts], [occurrenceToday(false)]);

		expect(flows.slice(0, 4)).toEqual([
			{ date: '2026-10-02', amount: 430, kind: 'income' },
			{ date: '2026-10-09', amount: 430, kind: 'income' },
			{ date: '2026-10-16', amount: 430, kind: 'income' },
			{ date: '2026-10-23', amount: 430, kind: 'income' }
		]);
		expect(flows.every(flow => flow.date >= TODAY && flow.amount === 430)).toBe(true);
	});

	it("skips today once a deposit arrived, and a smaller deposit doesn't reduce later due dates", () => {
		const flows = incomeFlows([payouts], [occurrenceToday(true)]);

		expect(flows[0]).toEqual({ date: '2026-10-09', amount: 430, kind: 'income' });
		expect(flows.every(flow => flow.amount === 430)).toBe(true);
	});

	it("raises checking by exactly the expected amounts, and leaves out income paid into an account the projection doesn't follow", () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(SAVINGS, 'depository', 6000)];
		const intoSavings: RecurringItem = { ...payouts, id: 'interest', name: 'Interest', matchRule: { matchText: 'Interest', accountId: SAVINGS } };
		const without = plannerFor().plan(input({ accounts, recurringItems: [intoSavings] }));
		const withIncome = plannerFor().plan(input({ accounts, recurringItems: [payouts, intoSavings] }));

		const lastDay = (projection: typeof without) => projection.days.at(-1);
		const dueDateCount = withIncome.days.filter(day => day.flows.some(flow => flow.label === payouts.name)).length;
		expect(without.days.some(day => day.flows.some(flow => flow.label === 'Interest'))).toBe(false);
		expect((lastDay(withIncome)?.checking ?? 0) - (lastDay(without)?.checking ?? 0)).toBeCloseTo(430 * dueDateCount, 2);
	});

	it("isn't projected while paused", () => {
		expect(incomeFlows([{ ...payouts, active: false }])).toEqual([]);
	});
});
