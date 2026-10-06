import { describe, expect, it } from 'vitest';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import { account, CARD, CHECKING, cardItem, input, monthly, monthlyPaychecks, plannerFor, recurringFlow, SIX_MONTHS, spent } from './projectedBalancesPlanner.fixtures';

describe('audited cases', () => {
	const interestCharge = (accountId: string, amount: number, description = 'INTEREST CHARGE ON PURCHASES') =>
		spent('2026-09-20', amount, accountId, { description, category: { id: 'fees', name: 'Financial & Legal Services', icon: null, groupType: 'expense' } });

	it("still pays a card outside Monarch next month once this month's is paid", () => {
		const outsideCard: RecurringItem = {
			id: 'store',
			kind: 'card',
			name: 'Store Card',
			recurrence: monthly(20),
			amount: 500,
			active: true,
			since: '2026-01',
			matchRule: { matchText: 'store', anyAmount: true }
		};
		const paidOccurrence = { item: outsideCard, dueDate: '2026-10-20', key: 'store@2026-10-20', amount: 500, paid: true, matchedTransaction: null, carried: false, overdue: false };

		const projection = plannerFor('2026-10-25').plan(input({ recurringItems: [outsideCard], outstandingOccurrences: [paidOccurrence] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-11-20', owed: 500, amount: 500 });
	});

	it("pays a card outside Monarch what's overdue today, and each later statement on its own date, never twice", () => {
		const outsideCard: RecurringItem = { id: 'store', kind: 'card', name: 'Store Card', recurrence: monthly(15), amount: 200, active: true, since: '2026-01' };
		const unpaid = (dueDate: string, carried: boolean) => ({ item: outsideCard, dueDate, key: `store@${dueDate}`, amount: 200, paid: false, matchedTransaction: null, carried, overdue: carried });

		const projection = plannerFor().plan(input({ recurringItems: [outsideCard], outstandingOccurrences: [unpaid('2026-09-15', true), unpaid('2026-10-15', false)] }));

		expect(projection.cards[0]?.payments.slice(0, 3).map(({ date, owed }) => ({ date, owed }))).toEqual([
			{ date: '2026-10-02', owed: 200 },
			{ date: '2026-10-15', owed: 200 },
			{ date: '2026-11-15', owed: 200 }
		]);
	});

	it("doesn't pay a card outside Monarch again for a statement already paid, when an earlier one is still owed", () => {
		const outsideCard: RecurringItem = {
			id: 'store',
			kind: 'card',
			name: 'Store Card',
			recurrence: `DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1,15`,
			amount: 300,
			active: true,
			since: '2026-01'
		};
		const occurrenceOn = (dueDate: string, paid: boolean) => ({ item: outsideCard, dueDate, key: `store@${dueDate}`, amount: 300, paid, matchedTransaction: null, carried: false, overdue: !paid });

		const projection = plannerFor('2026-10-10').plan(input({ recurringItems: [outsideCard], outstandingOccurrences: [occurrenceOn('2026-10-01', false), occurrenceOn('2026-10-15', true)] }));

		expect(projection.cards[0]?.payments.slice(0, 2).map(({ date }) => date)).toEqual(['2026-10-10', '2026-11-01']);
	});

	it("still pays what's left of a Monarch card's statement after a partial payment toward it", () => {
		const item = cardItem(10);
		const paidPart = { item, dueDate: '2026-10-10', key: `${item.id}@2026-10-10`, amount: 1900, paid: true, matchedTransaction: null, carried: false, overdue: false };
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -1900)];

		const projection = plannerFor().plan(input({ accounts, recurringItems: [item], outstandingOccurrences: [paidPart] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-10' });
		expect(projection.cards[0]?.payments[0]?.owed).toBeGreaterThan(1800);
		expect(projection.freeCash).toBeLessThan(3200);
	});

	it('asks for nothing more on a Monarch card statement paid in full early, regardless of charges since it closed', () => {
		const item = cardItem(10);
		const payment = { id: 'paid', date: '2026-10-01', amount: 800, description: 'PAYMENT', accountId: CARD };
		const paidInFull = { item, dueDate: '2026-10-10', key: `${item.id}@2026-10-10`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		// Everything owed now, including an insurance bill on the card, was charged after the statement closed Sep 15.
		const accounts = [account(CHECKING, 'depository', 300), account(CARD, 'credit', -1700, { minimumPayment: 90 })];
		const transactions = [spent('2026-09-16', 1200, CARD, { description: 'INSURANCE' }), spent('2026-09-20', 500, CARD)];

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [paidInFull] }));
		const october = projection.cards[0]?.payments.find(payment => payment.date === '2026-10-10');

		expect(october?.amount ?? 0).toBe(0);
		expect(october?.minimum ?? 0).toBe(0);
	});

	it("counts what's paid toward a statement against its minimum, and the latest due statement for today's payment", () => {
		const item = cardItem(25);
		const paidPart = { id: 'part', date: '2026-10-20', amount: 500, description: 'PAYMENT', accountId: CARD };
		const occurrences = [
			{ item, dueDate: '2026-09-25', key: `${item.id}@2026-09-25`, amount: 0, paid: false, matchedTransaction: null, carried: true, overdue: true },
			{ item, dueDate: '2026-10-25', key: `${item.id}@2026-10-25`, amount: 0, paid: true, matchedTransaction: paidPart, carried: false, overdue: false }
		];
		// Owed now: the October statement (closed Sep 30) less the $500, plus $300 charged since it closed.
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -5900, { minimumPayment: 180 })];
		const transactions = [spent('2026-10-05', 300, CARD), paidPart];

		const projection = plannerFor('2026-10-28').plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: occurrences }));
		const [today] = projection.cards[0]?.payments ?? [];

		expect(today).toMatchObject({ date: '2026-10-28', owed: 5600 });
		expect(today?.minimum).toBe(0);
	});

	it('keeps asking for the rest of an underpaid Monarch card statement past its due date, including the minimum', () => {
		const item = cardItem(25);
		const paidShort = { id: 'short', date: '2026-10-24', amount: 40, description: 'PAYMENT', accountId: CARD };
		const october = { item, dueDate: '2026-10-25', key: `${item.id}@2026-10-25`, amount: 0, paid: true, matchedTransaction: paidShort, carried: false, overdue: false };
		const accounts = [account(CHECKING, 'depository', 20), account(CARD, 'credit', -2960, { minimumPayment: 100 })];

		const projection = plannerFor('2026-10-26').plan(input({ accounts, transactions: [paidShort], recurringItems: [item], outstandingOccurrences: [october] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-26', owed: 2960, minimum: 60 });
	});

	it('counts every payment since a statement closed toward its minimum, not only the one matched', () => {
		const item = cardItem(10);
		const [first, second] = ['2026-09-30', '2026-10-01'].map((date, index) => ({ id: `p${index}`, date, amount: 30, description: 'PAYMENT', accountId: CARD }));
		const october = { item, dueDate: '2026-10-10', key: `${item.id}@2026-10-10`, amount: 0, paid: true, matchedTransaction: second ?? null, carried: false, overdue: false };
		const accounts = [account(CHECKING, 'depository', 0), account(CARD, 'credit', -2940, { minimumPayment: 60 })];

		const projection = plannerFor('2026-10-12').plan(input({ accounts, transactions: [first, second].filter(each => each !== undefined), recurringItems: [item], outstandingOccurrences: [october] }));

		expect(projection.cards[0]?.payments[0]?.minimum).toBe(0);
	});

	it('measures an overdue statement on a card without a card payment item from its real due date', () => {
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -1800)];
		const statement = recurringFlow('Card statement', 'credit_card', '2026-09-20', -1000, CARD, null, 'overdue');
		const transactions = [spent('2026-09-01', 500, CARD), spent('2026-09-15', 300, CARD)];

		const projection = plannerFor('2026-10-15').plan(input({ accounts, transactions, recurringFlows: [statement] }));

		// Due Sep 20, it closed Aug 26: both later charges are the next statement's.
		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-15', owed: 1000 });
	});

	it("measures what's left after a partial payment from the usual close, not the latest one", () => {
		const item = cardItem(20);
		const payment = { id: 'part', date: '2026-10-01', amount: 1500, description: 'PAYMENT', accountId: CARD };
		const october = { item, dueDate: '2026-10-20', key: `${item.id}@2026-10-20`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		// $2,600 was on the statement that closed Sep 25; $1,500 of it is paid.
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -1100)];

		const projection = plannerFor('2026-10-10').plan(
			input({ accounts, transactions: [spent('2026-09-10', 2000, CARD), spent('2026-09-24', 600, CARD), payment], recurringItems: [item], outstandingOccurrences: [october] })
		);

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-20', owed: 1100 });
	});

	it("gives Monarch's minimum to the statement that closed most recently", () => {
		const item = cardItem(3);
		const payment = { id: 'full', date: '2026-10-02', amount: 500, description: 'PAYMENT', accountId: CARD };
		const october = { item, dueDate: '2026-10-03', key: `${item.id}@2026-10-03`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		// October's statement is paid; November's closed Oct 9 at $3,000 and Monarch's $120 minimum is for it.
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -3000, { minimumPayment: 120 })];

		const projection = plannerFor('2026-10-15').plan(input({ accounts, transactions: [spent('2026-10-05', 3000, CARD), payment], recurringItems: [item], outstandingOccurrences: [october] }));
		const november = projection.cards[0]?.payments.find(each => each.date === '2026-11-03');

		expect(november).toMatchObject({ minimum: 120, minimumIsEstimated: false });
	});

	it("doesn't treat a partly paid statement as paid in full when big charges just before its close make up the difference", () => {
		const item = cardItem(17);
		const payment = { id: 'part', date: '2026-09-27', amount: 2100, description: 'PAYMENT', accountId: CARD };
		const october = { item, dueDate: '2026-10-17', key: `${item.id}@2026-10-17`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		// The statement that closed Sep 22 came to $2,600; $2,100 of it is paid, and $300 has been charged since.
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -800)];
		const transactions = [spent('2026-09-05', 2000, CARD), spent('2026-09-21', 600, CARD), payment, spent('2026-10-01', 300, CARD)];

		const projection = plannerFor('2026-10-05').plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [october] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-17', owed: 500 });
	});

	it("asks for nothing on a statement paid in full that closed 26 days before it's due", () => {
		const item = cardItem(15);
		const payment = { id: 'full', date: '2026-10-30', amount: 620, description: 'PAYMENT', accountId: CARD };
		const november = { item, dueDate: '2026-11-15', key: `${item.id}@2026-11-15`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		// $20 a day; the statement closed Oct 20 at $620 and was paid in full; since then, $20 a day again.
		const charges = Array.from({ length: 16 }, (_, day) => spent(Temporal.PlainDate.from('2026-10-21').add({ days: day }).toString(), 20, CARD));
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -320)];

		const projection = plannerFor('2026-11-05').plan(input({ accounts, transactions: [payment, ...charges], recurringItems: [item], outstandingOccurrences: [november] }));

		expect(projection.cards[0]?.payments.find(each => each.date === '2026-11-15')?.amount ?? 0).toBe(0);
	});

	it('still asks for a statement whose payment was returned', () => {
		const item = cardItem(15);
		const payment = { id: 'paid', date: '2026-11-01', amount: 1000, description: 'PAYMENT THANK YOU', accountId: CARD };
		const returned = { id: 'back', date: '2026-11-03', amount: -1000, description: 'PAYMENT RETURNED', accountId: CARD };
		const november = { item, dueDate: '2026-11-15', key: `${item.id}@2026-11-15`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -1200)];

		const projection = plannerFor('2026-11-10').plan(
			input({ accounts, transactions: [payment, returned, spent('2026-11-05', 200, CARD)], recurringItems: [item], outstandingOccurrences: [november] })
		);

		expect(projection.cards[0]?.payments.find(each => each.date === '2026-11-15')).toMatchObject({ owed: 1000 });
	});

	it('treats a fee described like a payment as a charge, not a returned payment', () => {
		const item = cardItem(15);
		const payment = { id: 'paid', date: '2026-10-14', amount: 400, description: 'PAYMENT THANK YOU', accountId: CARD };
		const october = { item, dueDate: '2026-10-15', key: `${item.id}@2026-10-15`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		const fee = spent('2026-10-25', 35, CARD, { description: 'LATE PAYMENT FEE' });
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -435, { minimumPayment: 40 })];
		const transactions = [payment, fee, spent('2026-10-22', 400, CARD)];

		const projection = plannerFor('2026-10-28').plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [october] }));

		expect(projection.cards[0]?.payments.find(each => each.date === '2026-10-28')).toBeUndefined();
	});

	it("asks today for the rest of last month's partly paid statement", () => {
		const item = cardItem(23);
		const payment = { id: 'part', date: '2026-10-23', amount: 492.33, description: 'PAYMENT', accountId: CARD };
		const october = { item, dueDate: '2026-10-23', key: `${item.id}@2026-10-23`, amount: 0, paid: true, matchedTransaction: payment, carried: true, overdue: false };
		// The October statement was $839.71, closed Sep 28; $100 charged since.
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -447.38)];

		const projection = plannerFor('2026-11-12').plan(
			input({ accounts, transactions: [payment, spent('2026-11-01', 100, CARD)], recurringItems: [item], outstandingOccurrences: [], settledOccurrences: [october] })
		);

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-11-12' });
		expect(projection.cards[0]?.payments[0]?.owed).toBeCloseTo(347.38, 2);
	});

	it('treats a statement as paid in full even with a later refund Monarch categorized as a transfer', () => {
		const item = cardItem(6);
		const payment = { id: 'full', date: '2026-11-05', amount: 1000, description: 'PAYMENT', accountId: CARD };
		const november = { item, dueDate: '2026-11-06', key: `${item.id}@2026-11-06`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		const refund = {
			id: 'refund',
			date: '2026-11-20',
			amount: 76,
			description: 'STORE REFUND',
			accountId: CARD,
			category: { id: 'ccp', name: 'Credit Card Payment', icon: null, groupType: 'transfer' }
		};
		// The November statement closed Oct 9 (28 days before) and was paid in full; since then $560.63 charged, $76 refunded.
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -484.63)];
		const charges = [spent('2026-10-10', 300, CARD), spent('2026-10-30', 260.63, CARD)];

		const projection = plannerFor('2026-11-22').plan(input({ accounts, transactions: [payment, refund, ...charges], recurringItems: [item], outstandingOccurrences: [november] }));

		expect(projection.cards[0]?.payments.find(each => each.date === '2026-11-22')).toBeUndefined();
	});

	it("doesn't take a second payment toward a statement for a refund, leaving what's still owed", () => {
		const item = cardItem(15);
		const [first, second] = [
			{ id: 'p1', date: '2026-09-25', amount: 500, description: 'PAYMENT', accountId: CARD },
			{ id: 'p2', date: '2026-10-10', amount: 450, description: 'PAYMENT', accountId: CARD }
		];
		const october = { item, dueDate: '2026-10-15', key: `${item.id}@2026-10-15`, amount: 0, paid: true, matchedTransaction: second ?? null, carried: false, overdue: false };
		// The statement that closed Sep 20 came to $1,000; $950 of it is paid.
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -250)];
		const transactions = [spent('2026-09-05', 900, CARD), spent('2026-09-18', 100, CARD), spent('2026-09-28', 200, CARD), ...[first, second].filter(each => each !== undefined)];

		const projection = plannerFor('2026-10-12').plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [october] }));

		expect(projection.cards[0]?.payments.find(each => each.date === '2026-10-15')?.owed).toBeCloseTo(50, 2);
	});

	it("doesn't take a late fee the same as a payment for that payment sent back", () => {
		const item = cardItem(15);
		const payment = { id: 'min', date: '2026-10-16', amount: 40, description: 'PAYMENT THANK YOU', accountId: CARD };
		const fee = spent('2026-10-16', 40, CARD, { description: 'LATE PAYMENT FEE' });
		const september = { item, dueDate: '2026-09-15', key: `${item.id}@2026-09-15`, amount: 0, paid: false, matchedTransaction: null, carried: true, overdue: true };
		const october = { item, dueDate: '2026-10-15', key: `${item.id}@2026-10-15`, amount: 0, paid: true, matchedTransaction: payment, carried: false, overdue: false };
		const accounts = [account(CHECKING, 'depository', 50000), account(CARD, 'credit', -2000, { minimumPayment: 40 })];

		const projection = plannerFor('2026-10-18').plan(
			input({ accounts, transactions: [spent('2026-09-10', 2000, CARD), payment, fee], recurringItems: [item], outstandingOccurrences: [september, october] })
		);

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-18', minimum: 0 });
	});

	it('asks the latest overdue statement of a Monarch card for what it closed at, when two are overdue', () => {
		const item = cardItem(1);
		const unpaid = (dueDate: string) => ({ item, dueDate, key: `${item.id}@${dueDate}`, amount: 0, paid: false, matchedTransaction: null, carried: true, overdue: true });
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -2000)];
		const transactions = ['2026-07', '2026-08', '2026-09'].map(month => spent(`${month}-10`, 900, CARD));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [unpaid('2026-09-01'), unpaid('2026-10-01')] }));

		// October 1's statement closed Sep 6; the $900 posted Sep 10 came after it.
		expect(projection.cards[0]?.payments[0]?.owed).toBeCloseTo(2000 - 900, 2);
	});

	it('asks an overdue Monarch card statement for what closed before its real due date, and the next one for the rest of its statement', () => {
		const item = cardItem(15);
		const unpaid = { item, dueDate: '2026-09-15', key: `${item.id}@2026-09-15`, amount: 0, paid: false, matchedTransaction: null, carried: true, overdue: true };
		const accounts = [account(CHECKING, 'depository', 10000), account(CARD, 'credit', -2000)];
		const transactions = ['2026-07', '2026-08', '2026-09'].map(month => spent(`${month}-10`, 900, CARD));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [item], outstandingOccurrences: [unpaid] }));
		const [overdue, october, november] = projection.cards[0]?.payments ?? [];

		// Due Sep 15, it closed Aug 21, before the $900 posted Sep 10; October's closed Sep 20, after it, so the two together
		// come to the whole balance, and November's is what's charged from here.
		expect(overdue?.owed).toBeCloseTo(2000 - 900, 2);
		expect((overdue?.amount ?? 0) + (october?.amount ?? 0)).toBeCloseTo(2000, 2);
		expect(november?.owed).toBeLessThan(1000);
	});

	it("counts a card's credit balance against what it owes", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', 150)];
		const transactions = SIX_MONTHS.map(month => spent(`${month}-10`, 365, CARD));

		const projection = plannerFor().plan(input({ accounts, transactions, recurringItems: [cardItem(20)] }));

		// October's statement closed in credit, so nothing is due; November's closes Oct 26 with 24 days of $12 against the $150.
		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-11-20' });
		expect(projection.cards[0]?.payments[0]?.owed).toBeCloseTo(24 * 12 - 150);
	});

	it("accrues interest at the rate a card's last interest charge implies when Monarch has no APR", () => {
		const accounts = [account(CHECKING, 'depository', 0), account(CARD, 'credit', -1000)];

		const projection = plannerFor().plan(input({ accounts, transactions: [interestCharge(CARD, 20)], recurringItems: [cardItem(20)] }));

		// $20 on $1,000 is 2% a month, 24% a year. Nothing gets paid, so November's statement, closing Oct 26, carries the 24 days of it from tomorrow.
		expect(projection.cards[0]?.apr).toBeCloseTo(24);
		expect(projection.cards[0]?.payments[1]?.owed).toBeCloseTo(1000 * (1 + 0.24 / 365) ** 24, 2);
	});

	it('makes a card statement still unpaid from late last month due today', () => {
		const item = cardItem(30);
		const unpaid = { item, dueDate: '2026-09-30', key: `${item.id}@2026-09-30`, amount: 400, paid: false, matchedTransaction: null, carried: true, overdue: true };
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -400)];

		const projection = plannerFor().plan(input({ accounts, recurringItems: [item], outstandingOccurrences: [unpaid] }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-02', amount: 400 });
	});

	it("lets a card payment use a paycheck landing on its due date, while bills that morning still can't", () => {
		const accounts = [account(CHECKING, 'depository', 0), account(CARD, 'credit', -500, { minimumPayment: 40 })];
		const recurringFlows = [...monthlyPaychecks(3000, '2026-10-20'), recurringFlow('Rent', 'expense', '2026-10-20', -100)];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)] }));
		const dueDay = projection.days.find(day => day.date === '2026-10-20');

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-20', amount: 500 });
		expect(dueDay?.lowestChecking).toBe(-100);
		expect(dueDay?.checking).toBe(3000 - 100 - 500);
	});

	it("pairs the day's low with what the cards owe at the same moment", () => {
		const accounts = [account(CHECKING, 'depository', 100), account(CARD, 'credit', -3000)];
		const recurringFlows = [recurringFlow('Rent', 'expense', '2026-10-20', -900), ...monthlyPaychecks(3000, '2026-10-20')];

		const projection = plannerFor().plan(input({ accounts, recurringFlows, recurringItems: [cardItem(20)] }));
		const dueDay = projection.days.find(day => day.date === '2026-10-20');

		// In the morning, before the paycheck and the card payment, checking is -800 and the card still owes all of it.
		expect(dueDay?.lowestAfterCards).toBeCloseTo(100 - 900 - 3000);
	});

	it('counts a Monarch card once when two card payment items track it', () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -1000)];
		const second = { ...cardItem(20), id: 'second-item' };

		const projection = plannerFor().plan(input({ accounts, recurringItems: [cardItem(20), second] }));

		expect(projection.cards).toHaveLength(1);
		expect(projection.days[0]?.cardsOwed).toBe(1000);
	});

	it('caps the rate implied by an interest charge, since it was charged on a balance that has since been paid down', () => {
		const accounts = [account(CHECKING, 'depository', 0), account(CARD, 'credit', -200)];

		const projection = plannerFor().plan(input({ accounts, transactions: [interestCharge(CARD, 50)], recurringItems: [cardItem(20)] }));

		expect(projection.cards[0]?.apr).toBe(36);
	});

	it('treats a limit of $0 as no known limit', () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -400, { limit: 0 })];

		const projection = plannerFor().plan(input({ accounts, recurringItems: [cardItem(20)] }));

		expect(projection.creditLimit).toBeNull();
		expect(projection.burndown.events.filter(event => event.kind === 'cardMaxedOut')).toEqual([]);
	});

	it('never lets a card payment take checking below the cushion within the free cash window', () => {
		// Due Oct 5 and Oct 12 only; the Oct 5 payment's cycle ends at the Oct 13 payday, but free cash looks to Nov 1, past rent on Oct 25.
		const outsideCard: RecurringItem = {
			id: 'short',
			kind: 'card',
			name: 'Short Card',
			recurrence: 'DTSTART:20261005T000000Z\nRRULE:FREQ=WEEKLY;COUNT=2',
			amount: 300,
			active: true,
			since: '2026-01',
			matchRule: { matchText: 'short', anyAmount: true }
		};
		const recurringFlows = [recurringFlow('Paycheck', 'income', '2026-10-13', 100), recurringFlow('Rent', 'expense', '2026-10-25', -2200)];

		const projection = plannerFor().plan(input({ accounts: [account(CHECKING, 'depository', 2500)], recurringFlows, recurringItems: [outsideCard], cushion: 200 }));

		expect(projection.cards[0]?.payments[0]).toMatchObject({ date: '2026-10-05', amount: 200 });
		expect(projection.shortfall).toBe(0);
	});

	it("doesn't treat a purchase from a merchant with interest in its name as an interest charge", () => {
		const accounts = [account(CHECKING, 'depository', 5000), account(CARD, 'credit', -1000, { apr: 24 })];
		const pinterest = spent('2026-09-20', 50, CARD, { description: 'PINTEREST ADS', category: { id: 'ads', name: 'Advertising', icon: null, groupType: 'expense' } });

		const projection = plannerFor().plan(input({ accounts, transactions: [pinterest], recurringItems: [cardItem(20)] }));

		expect(projection.cards[0]?.chargesInterest).toBe(false);
	});

	it('leaves out an unpaid item from earlier this month that Monarch thinks has ended', () => {
		const recurringFlows = [recurringFlow('Streaming', 'expense', '2026-10-01', -15, CHECKING, null, 'possibly_inactive'), recurringFlow('Gym', 'expense', '2026-10-01', -40)];

		const projection = plannerFor().plan(input({ recurringFlows }));
		const labels = projection.days.flatMap(day => day.flows.map(flow => flow.label));

		expect(labels).not.toContain('Streaming');
		expect(labels).toContain('Gym');
	});
});
