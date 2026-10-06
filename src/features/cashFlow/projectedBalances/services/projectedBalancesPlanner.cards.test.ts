import { describe, expect, it } from 'vitest';
import type { Account } from '../../../../monarch/api/models/account';
import type { ProjectedDay } from '../models/projection';
import { account, CARD, CHECKING, cardItem, input, monthlyPaychecks, plannerFor, recurringFlow, SIX_MONTHS, spent } from './projectedBalancesPlanner.fixtures';

describe('paying cards what checking allows', () => {
	const paymentsOn = (projection: { cards: { name: string; payments: { date: string; amount: number }[] }[] }, date: string) =>
		Object.fromEntries(projection.cards.map(card => [card.name, card.payments.find(payment => payment.date === date)?.amount]));

	it('pays a card what checking can spare above the cushion and leaves the rest on the card for next time', () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(CARD, 'credit', -3000, { minimumPayment: 50 })];
		const recurringFlows = [recurringFlow('Paycheck', 'income', '2026-10-25', 5000)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)], cushion: 200 }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-20', amount: 800, owed: 3000, minimum: 50 });
		expect(Math.min(...projection.days.map(day => day.lowestChecking))).toBe(200);
		expect(projection.cards[0]?.payments[1]).toMatchObject({ date: '2026-11-20', amount: 2200, owed: 2200 });
	});

	it("keeps the cushion through the card's cycle, so a tight month further out doesn't hold this payment back", () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(CARD, 'credit', -3000, { minimumPayment: 50 })];
		const recurringFlows = [...monthlyPaychecks(100), recurringFlow('Insurance', 'expense', '2027-03-01', -5000)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)], cushion: 200 }));

		// The cycle runs to the first payday after Nov 20; Nov 25's paycheck covers November's minimum.
		expect(projection.cards[0]?.payments[0]?.amount).toBe(800);
	});

	it('keeps the cushion past the next due date until the next income', () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(CARD, 'credit', -3000, { minimumPayment: 50 })];
		const recurringFlows = [...monthlyPaychecks(2000, '2026-11-25'), recurringFlow('Rent', 'expense', '2026-11-22', -300)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)], cushion: 200 }));

		// Rent on Nov 22 comes before the Nov 25 paycheck, and November's minimum is set aside too.
		const [october, november] = projection.cards[0]?.payments ?? [];
		expect((october?.amount ?? 0) + (november?.minimum ?? 0)).toBeCloseTo(800 - 300, 1);
		expect(Math.min(...projection.days.map(day => day.lowestChecking))).toBeGreaterThanOrEqual(200);
	});

	it('charges interest daily on a balance carried from a statement not paid in full, and stops once one is', () => {
		const interest = spent('2026-09-20', 20, CARD, { category: { id: 'interest', name: 'Interest Charges', icon: null, groupType: 'expense' } });
		const accounts = [account(CHECKING, 'depository', 0), account(CARD, 'credit', -1000, { apr: 36.5, minimumPayment: 0 })];

		const unpaid = plannerFor().plan(input({ accounts, transactions: [interest], recurringItems: [cardItem(20)] }));
		// 0.1% a day, from tomorrow through Oct 26 when November's statement closes.
		expect(unpaid.cards[0]?.payments[1]?.owed).toBeCloseTo(1000 * 1.001 ** 24, 2);

		const paidOff = plannerFor().plan(
			input({ accounts: [account(CHECKING, 'depository', 5000), accounts[1] as Account], recurringFlows: monthlyPaychecks(100), transactions: [interest], recurringItems: [cardItem(20)] })
		);
		// October's statement paid in full on the 20th stops interest; November's is the interest that ran until then.
		expect(paidOff.cards[0]?.payments[0]?.amount).toBe(1000);
		expect(paidOff.cards[0]?.payments[1]?.owed).toBeCloseTo(1000 * (1.001 ** 18 - 1), 2);
		expect(paidOff.days.find(day => day.date === '2026-11-21')?.cardsOwed).toBeCloseTo(0, 2);
	});

	it("sets later cards' minimums aside before paying extra on the card due first", () => {
		const accounts = [account(CHECKING, 'depository', 1000), account('first', 'credit', -2000, { minimumPayment: 50 }), account('second', 'credit', -2000, { minimumPayment: 100 })];
		const recurringItems = [cardItem(10, 'first'), cardItem(20, 'second')];
		const recurringFlows = [recurringFlow('Paycheck', 'income', '2026-10-25', 5000)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems, cardAccountIds: ['first', 'second'] }));

		expect(paymentsOn(projection, '2026-10-10')['Card first']).toBe(900);
		expect(paymentsOn(projection, '2026-10-20')['Card second']).toBe(100);
	});

	it("sizes a payment as if later due dates will be paid too, so cards left unpaid don't max out into checking", () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(CARD, 'credit', -500, { limit: 1500 })];
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365, CARD));
		const paychecks = Array.from({ length: 12 }, (_, months) => recurringFlow('Paycheck', 'income', `${Temporal.PlainDate.from('2026-10-25').add({ months })}`, 1500));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringFlows: paychecks, recurringItems: [cardItem(20)] }));

		expect(projection.cards[0]?.payments.slice(0, 3).map(payment => payment.amount)).toEqual(projection.cards[0]?.payments.slice(0, 3).map(payment => payment.owed));
	});

	it("pays what it can toward a minimum checking can't cover", () => {
		const accounts = [account(CHECKING, 'depository', 30), account(CARD, 'credit', -500, { minimumPayment: 50 })];

		const projection = plannerFor().plan(input({ accounts, recurringItems: [cardItem(20)] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ amount: 30, minimum: 50 });
	});

	it('waits for a paycheck before a due date only when the paycheck comes first', () => {
		const accounts = [account(CHECKING, 'depository', 100), account(CARD, 'credit', -1000)];
		const recurringFlows = [recurringFlow('Paycheck', 'income', '2026-10-15', 2000)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-20', amount: 1000 });
	});
});

describe('burndown', () => {
	const dayOf = (days: ProjectedDay[], date: string) => days.find(day => day.date === date);

	it("puts charges past a card's limit on the next counted card with room, and leaves checking alone", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account('first', 'credit', -400, { limit: 500 }), account('second', 'credit', 0, { limit: 1000 })];
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365, 'first'));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [cardItem(25, 'first'), cardItem(25, 'second')], cardAccountIds: ['first', 'second'] }));
		const day = dayOf(projection.burndown.days, '2026-10-20');

		expect(projection.burndown.events).toContainEqual({ date: '2026-10-11', kind: 'cardMaxedOut', label: 'Card first maxes out' });
		// 400 plus 12 a day for 18 days: 500 on the first card, the rest on the second.
		expect(day).toMatchObject({ cardsOwed: 400 + 18 * 12, creditUsed: 400 + 18 * 12, checking: 5000 });
		expect(day?.creditLeft).toBeCloseTo(1500 - (400 + 18 * 12));
	});

	it("keeps charges past a card's limit on the card once no other card has room, flagged as maxing it out, and leaves checking alone", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -400, { limit: 500 })];
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365, CARD));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [cardItem(25)] }));

		// 400 owed plus 12 a day from tomorrow passes 500 on the ninth day of charges.
		expect(projection.burndown.events).toContainEqual({ date: '2026-10-11', kind: 'cardMaxedOut', label: `Card ${CARD} maxes out` });
		expect(dayOf(projection.burndown.days, '2026-10-11')).toMatchObject({ cardsOwed: 400 + 9 * 12, creditLeft: 0, checking: 5000 });
	});

	it("adds up the counted cards' limits, leaving out cards without one and cards not counted", () => {
		const accounts = [
			account(CHECKING, 'depository', 1000),
			account('cheap', 'credit', 0, { limit: 1000 }),
			account('costly', 'credit', 0, { dataProviderCreditLimit: 2500 }),
			account('unknown', 'credit', 0),
			account('uncounted', 'credit', 0, { limit: 9000 })
		];

		const projection = plannerFor().plan(input({ accounts, cardAccountIds: ['cheap', 'costly', 'unknown'] }));

		expect(projection.creditLimit).toBe(3500);
		expect(plannerFor().plan(input({ accounts, cardAccountIds: ['unknown'] })).creditLimit).toBeNull();
	});

	it('covers checking from the cards, then the reserves, then the cushion, and free cash counts none of it', () => {
		const accounts = [account(CHECKING, 'depository', 1000), account(CARD, 'credit', -900, { limit: 1000 }), account('savings', 'depository', 300)];
		const recurringFlows = [recurringFlow('Rent', 'expense', '2026-10-05', -1200)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, reserveAccountIds: ['savings'], cushion: 500 }));
		const rentDay = dayOf(projection.burndown.days, '2026-10-05');

		expect(rentDay?.flows.filter(flow => flow.kind === 'draw').map(({ label, amount }) => ({ label, amount }))).toEqual([
			{ label: `On ${CARD}`, amount: 100 },
			{ label: 'From savings', amount: 300 }
		]);
		expect(rentDay).toMatchObject({ lowestChecking: 200, creditLeft: 0 });
		expect(projection.burndown.events.filter(event => event.date === '2026-10-05').map(event => event.kind)).toEqual(['cardMaxedOut', 'cushionUsed']);
		expect(projection.burndown.events.some(event => event.kind === 'outOfCash' && event.date < '2026-11-01')).toBe(false);
		// Cash only, checking falls to -200 on Oct 5, so the card's 900, assumed due Nov 1, stays on the card.
		expect(projection.freeCash).toBe(0);
		expect(projection.shortfall).toBe(500 + 200);
		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-11-01', amount: 0, owed: 900 });
	});

	it("borrows on the cards in the household's order", () => {
		const accounts = [account(CHECKING, 'depository', 1000), account('cheap', 'credit', 0, { limit: 1000, apr: 10 }), account('costly', 'credit', 0, { limit: 1000, apr: 25 })];
		const recurringFlows = [recurringFlow('Rent', 'expense', '2026-10-05', -1300)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, cardAccountIds: ['costly', 'cheap'] }));
		const draws = projection.burndown.days.find(day => day.date === '2026-10-05')?.flows.filter(flow => flow.kind === 'draw');

		expect(draws?.map(({ label, amount }) => ({ label, amount }))).toEqual([{ label: 'On costly', amount: 300 }]);
	});

	it("leaves out a card that isn't counted as debt", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -400)];

		const projection = plannerFor().plan(input({ accounts, cardAccountIds: [] }));

		expect(projection.cards).toEqual([]);
		expect(projection.burndown.days[0]?.cardsOwed).toBe(0);
	});
});

describe('paying in full', () => {
	it('pays a balance with fractions of a cent exactly, so it reads as paid in full', () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -100)];
		// A third of a dollar posted since the statement closed leaves the statement with fractions of a cent.
		const transactions = [...SIX_MONTHS.map(month => spent(`${month}-10`, 100 / 3, CARD)), spent('2026-10-01', 100 / 3, CARD)];

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [cardItem(20)] }));
		const [payment] = projection.cards[0]?.payments ?? [];

		expect(payment?.owed).not.toBe(Math.round((payment?.owed ?? 0) * 100) / 100);
		expect(payment?.amount).toBe(payment?.owed);
	});
});
