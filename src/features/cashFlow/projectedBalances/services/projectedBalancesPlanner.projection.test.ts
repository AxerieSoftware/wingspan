import { describe, expect, it } from 'vitest';
import type { RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import { account, CARD, CHECKING, cardItem, input, plannerFor, recurringFlow, SIX_MONTHS, spent, TODAY } from './projectedBalancesPlanner.fixtures';

describe('projected balances', () => {
	it("finds the lowest point, takes a day's outflows before its inflows, and leaves the cushion", () => {
		const recurringFlows = [recurringFlow('Rent', 'expense', '2026-10-15', -1500), recurringFlow('Paycheck', 'income', '2026-10-15', 3200), recurringFlow('Phone', 'expense', '2026-10-20', -42)];

		const projection = plannerFor().plan(input({ recurringFlows, cushion: 500 }));

		expect(projection.reversible).toEqual({ endDate: '2026-11-01', lowestChecking: 3500, lowestDate: '2026-10-15', firstShortDate: null });
		expect(projection.freeCash).toBe(3000);
	});

	it('reports a shortfall from the first day below the cushion, by the largest gap, and never from float noise', () => {
		const recurringFlows = [recurringFlow('Phone', 'expense', '2026-10-05', -100), recurringFlow('Rent', 'expense', '2026-10-20', -1500)];

		const short = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 1000)], recurringFlows, cushion: 950 }));
		expect(short.reversible).toMatchObject({ firstShortDate: '2026-10-05', lowestDate: '2026-10-20' });
		expect(short.shortfall).toBe(950 - (1000 - 100 - 1500));

		const exact = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 0.3)], cushion: 0.1 + 0.2 }));
		expect(exact.shortfall).toBe(0);
		expect(exact.reversible.firstShortDate).toBeNull();
	});

	it("carries an earlier month's payment Monarch still marks overdue to today, and nothing else from earlier months", () => {
		const recurringFlows = [
			recurringFlow('Gym', 'expense', '2026-09-25', -100, CHECKING, null, 'overdue'),
			recurringFlow('Old phone', 'expense', '2026-09-14', -40, CHECKING, null, 'possibly_inactive'),
			recurringFlow('Paid rent', 'expense', '2026-09-02', -1500, CHECKING, null, 'paid'),
			recurringFlow('Late refund', 'income', '2026-09-20', 60, CHECKING, null, 'overdue')
		];

		const projection = plannerFor().plan(input({ recurringFlows }));
		const todayFlows = projection.days[0]?.flows.filter(flow => flow.kind !== 'spending');

		expect(todayFlows?.map(({ label, amount }) => ({ label, amount }))).toEqual([{ label: 'Gym', amount: -100 }]);
	});

	it("puts Monarch's items on the household's own due day, unless they come due more than once a month", () => {
		const twiceMonthly: RecurringFlow = {
			recurrenceGroup: { id: 'Paycheck', name: 'Paycheck', recurringType: 'income', amount: 1000, account: { id: CHECKING }, merchant: null },
			occurrences: [
				{ date: '2026-10-15', status: 'upcoming', amount: 1000, account: { id: CHECKING } },
				{ date: '2026-10-30', status: 'upcoming', amount: 1000, account: { id: CHECKING } }
			]
		};
		const recurringFlows = [recurringFlow('Gym', 'expense', '2026-10-25', -100), recurringFlow('Rent', 'expense', '2026-10-02', -1500), twiceMonthly];

		const projection = plannerFor().plan(input({ recurringFlows, dueDayByRecurrenceId: { Gym: 20, Rent: 1, Paycheck: 5 } }));
		const datesOf = (label: string) => projection.days.flatMap(day => day.flows.filter(flow => flow.label === label).map(() => day.date));

		expect(datesOf('Gym')).toEqual(['2026-10-20']);
		// The 1st has passed unpaid, so it's due today.
		expect(datesOf('Rent')).toEqual([TODAY]);
		expect(datesOf('Paycheck')).toEqual(['2026-10-15', '2026-10-30']);
	});

	it("runs to the next payday when it's more than 30 days out", () => {
		const recurringFlows = [recurringFlow('Bonus', 'income', '2026-11-20', 2000), recurringFlow('Insurance', 'expense', '2026-11-19', -900)];

		const projection = plannerFor().plan(input({ recurringFlows }));

		expect(projection.reversible.endDate).toBe('2026-11-20');
		expect(projection.reversible.lowestChecking).toBe(4100);
	});

	it("takes checking's everyday spending out daily from tomorrow, since today's is already in the balance", () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365 / 12));

		const projection = plannerFor().plan(input({ transactions }));

		expect(projection.days[0]?.lowestChecking).toBeCloseTo(5000);
		expect(projection.days[1]?.lowestChecking).toBeCloseTo(4999);
		expect(projection.reversible.lowestChecking).toBeCloseTo(5000 - 30);
	});

	it("builds up a card's spending and pays each statement's balance from checking on its due date", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -400)];
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365, CARD));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [cardItem(20)] }));
		const card = projection.cards[0];

		// October's statement closed Sep 25 and nothing has posted since, so all 400 is on it. November's closes Oct 26 with
		// the charges from tomorrow through then, at $12 a day.
		expect(card?.payments[0]).toMatchObject({ date: '2026-10-20', amount: 400 });
		expect(card?.payments[1]?.date).toBe('2026-11-20');
		expect(card?.payments[1]?.amount).toBeCloseTo(24 * 12);
		expect(projection.reversible.lowestChecking).toBe(5000 - 400);
	});

	it("counts a card's recurring charges on the card, not checking", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', 0)];
		const recurringFlows = [recurringFlow('Streaming', 'expense', '2026-10-05', -20, CARD)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)] }));

		// The Oct 5 charge comes after October's statement closed, so it's on November's.
		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-11-20', amount: 20 });
		expect(projection.days.find(day => day.date === '2026-10-05')?.checking).toBe(5000);
	});

	it("pays a card without a card payment item when Monarch's recurring statement for it is due", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -250)];
		const recurringFlows = [recurringFlow('Card statement', 'credit_card', '2026-10-22', -250, CARD)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows }));

		expect(projection.cards[0]).toMatchObject({ hasDueDate: true, payments: [{ date: '2026-10-22', amount: 250 }] });
	});

	it('otherwise pays it on the day of the month it was last paid', () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -250)];
		const payment = spent('2026-09-18', -400, CARD, { category: { id: 'card', name: 'Credit Card Payment', icon: null, groupType: 'transfer' } });

		const projection = plannerFor().plan(input({ accounts, transactions: [payment] }));

		expect(projection.cards[0]).toMatchObject({ hasDueDate: true, payments: [{ date: '2026-10-18', amount: 250 }] });
	});

	it('assumes a card with no due date and no payments is due in 30 days, and flags it', () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -250)];

		const projection = plannerFor().plan(input({ accounts }));

		expect(projection.cards[0]).toMatchObject({ hasDueDate: false, owedToday: 250, payments: [{ date: '2026-11-01', amount: 250 }] });
	});

	it('reports how far the lowest point falls below the cushion', () => {
		const recurringFlows = [recurringFlow('Rent', 'expense', '2026-10-03', -4800)];

		const projection = plannerFor().plan(input({ recurringFlows, cushion: 500 }));

		expect(projection.freeCash).toBe(0);
		expect(projection.shortfall).toBe(300);
	});
});
