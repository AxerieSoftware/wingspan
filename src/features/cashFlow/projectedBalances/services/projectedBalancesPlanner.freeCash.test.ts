import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { FreeCashSplitter } from '../../freeCash/services/freeCashSplitter';
import { account, CARD, CHECKING, input, monthlyPaychecks, plannerFor, recurringFlow, SIX_MONTHS, spent, TODAY } from './projectedBalancesPlanner.fixtures';

describe('pending transactions', () => {
	it('takes pending money out of checking right away, and adds pending money in only once it posts', () => {
		const transactions = [spent(TODAY, 300, CHECKING, { pending: true }), spent(TODAY, -1000, CHECKING, { pending: true })];

		const projection = plannerFor().plan(input({ transactions }));

		expect(projection.checkingBalance).toBe(4700);
		expect(projection.freeCash).toBe(4700);
	});

	it("owes a card's pending purchases on top of its balance, without counting them in its statement", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -250)];
		const recurringFlows = [recurringFlow('Card statement', 'credit_card', '2026-10-22', -250, CARD)];
		const transactions = [spent(TODAY, 80, CARD, { pending: true })];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, transactions }));

		expect(projection.days[0]?.cardsOwed).toBe(330);
		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-22', owed: 250 });
	});

	it('counts a pending purchase in the usual spending pace, as it will once posted', () => {
		const transactions = [...SIX_MONTHS.map(month => spent(`${month}-10`, 100)), spent('2026-09-30', 900, CHECKING, { pending: true })];

		const { pace } = plannerFor().plan(input({ transactions }));

		// July, August and September: 100, 100 and 1000.
		expect(pace.monthlyByAccountId.get(CHECKING)).toBe(100);
	});
});

describe('how far ahead free cash is kept safe', () => {
	it("keeps a bill due within the household's chosen days covered, but not one due after them", () => {
		const recurringFlows = [recurringFlow('Tuition', 'expense', '2026-11-20', -3000)];

		const within30 = plannerFor().plan(input({ recurringFlows, safetyDays: 30 }));
		const within60 = plannerFor().plan(input({ recurringFlows, safetyDays: 60 }));

		expect(within30.freeCash).toBe(5000);
		expect(within60.freeCash).toBe(2000);
		expect(within60.reversible.endDate).toBe('2026-12-01');
	});
});

describe('monthly surplus', () => {
	it("is a month's income minus its bills and everyday spending, leaving out what's carried to today from earlier months", () => {
		const rent = Array.from({ length: 12 }, (_, months) => recurringFlow('Rent', 'expense', Temporal.PlainDate.from('2026-11-01').add({ months }).toString(), -1450));
		const overdue = recurringFlow('Gym', 'expense', '2026-09-25', -100, CHECKING, null, 'overdue');
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 400));

		const projection = plannerFor().plan(input({ recurringFlows: [...monthlyPaychecks(3000), ...rent, overdue], transactions }));

		expect(projection.monthlySurplus).toBe(3000 - 1450 - 400);
	});

	it('is below $0 when spending outruns income', () => {
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 3500));

		const projection = plannerFor().plan(input({ recurringFlows: monthlyPaychecks(3000), transactions }));

		expect(projection.monthlySurplus).toBe(-500);
	});
});

describe('free cash split', () => {
	it("promises the rest of this month's goal contributions plus each later month's that starts before the window ends", () => {
		const splitter = new FreeCashSplitter(new Calendar(() => Temporal.PlainDate.from(TODAY)));
		const contributions = [
			{ goalName: 'Trip', month: '2026-10', planned: 200, remaining: 150 },
			{ goalName: 'Trip', month: '2026-11', planned: 200, remaining: 200 },
			{ goalName: 'Car', month: '2026-12', planned: 400, remaining: 400 }
		];

		expect(splitter.split(1000, contributions, '2026-11-01')).toEqual({ promised: 350, trulyFree: 650, goals: [{ name: 'Trip', amount: 350 }] });
		expect(splitter.split(100, contributions, '2026-10-31').trulyFree).toBe(-50);
	});
});
