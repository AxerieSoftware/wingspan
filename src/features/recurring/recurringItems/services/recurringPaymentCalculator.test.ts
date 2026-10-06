import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { Formatter } from '../../../../monarch/ui/formatter';
import { ManualBillKind } from '../../manualBills/manualBillKind';
import { RecurringItemInferrer } from '../../manualBills/services/recurringItemInferrer';
import { CardPaymentKind } from '../../statements/cardPaymentKind';
import { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../models/recurringItem';
import { RecurrenceCalculator } from './recurrenceCalculator';
import { RecurringItemFactory } from './recurringItemFactory';
import { RecurringPaymentCalculator } from './recurringPaymentCalculator';
import { TransactionMatcher } from './transactionMatcher';

const CHECKING = 'checking';
const SAPPHIRE = 'sapphire';

function calculatorOn(today: string) {
	const calendar = new Calendar(() => Temporal.PlainDate.from(today));
	const recurrence = new RecurrenceCalculator(calendar);
	const matcher = new TransactionMatcher();
	const kinds = new RecurringItemKindRegistry([new ManualBillKind(matcher, new RecurringItemInferrer(recurrence), new Formatter(calendar)), new CardPaymentKind(matcher)]);
	return new RecurringPaymentCalculator(calendar, recurrence, kinds);
}

const monthly = (day: number) => `DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`;
const card = (id: string, dueDay: number, extra: Partial<RecurringItem> & { accountId?: string } = {}): RecurringItem => ({
	id,
	kind: 'card',
	name: id,
	recurrence: monthly(dueDay),
	amount: 0,
	active: true,
	since: '2026-01',
	...extra
});
const bill = (id: string, dueDay: number, amount: number, matchText: string, since = '2026-10'): RecurringItem => ({
	id,
	kind: 'bill',
	name: id,
	recurrence: monthly(dueDay),
	amount,
	active: true,
	since,
	matchRule: { matchText }
});

let count = 0;
const transaction = (date: string, amount: number, accountId: string, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${++count}`, date, amount, description: '', accountId, ...extra });
const cardPayment = (date: string, amount: number, accountId = SAPPHIRE) =>
	transaction(date, amount, accountId, { description: 'Payment, thank you', category: { id: 'ccp', name: 'Credit Card Payment', icon: null, groupType: 'transfer' } });

const ledgerOf = (today: string, items: RecurringItem[], transactions: Transaction[], owed: Record<string, number> = {}) =>
	calculatorOn(today).ledger({ trackingSince: '2026-01', recurringItems: items }, transactions, owed);
const occurrenceOf = (ledger: ReturnType<typeof ledgerOf>, itemId: string, dueDate: string) => ledger.settledByKey.get(`${itemId}@${dueDate}`);

describe('card payments', () => {
	it("aren't marked paid by a refund or statement credit on the card", () => {
		const refund = transaction('2026-10-12', 15, SAPPHIRE, { description: 'Return', category: { id: 'shopping', name: 'Shopping', icon: null, groupType: 'expense' } });
		const ledger = ledgerOf('2026-10-15', [card('Sapphire', 20, { accountId: SAPPHIRE })], [refund], { [SAPPHIRE]: 2000 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-20')).toMatchObject({ paid: false, amount: 2000 });
	});

	it('are marked paid by a payment arriving on the card', () => {
		const ledger = ledgerOf('2026-10-15', [card('Sapphire', 20, { accountId: SAPPHIRE })], [cardPayment('2026-10-14', 500)], { [SAPPHIRE]: 1500 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-20')).toMatchObject({ paid: true, amount: 500 });
	});

	it("count a late payment until the next statement's window opens", () => {
		const ledger = ledgerOf('2026-10-25', [card('Sapphire', 1, { accountId: SAPPHIRE })], [cardPayment('2026-10-15', 500)], { [SAPPHIRE]: 1500 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-01')).toMatchObject({ paid: true });
	});

	it("reserve the checking side of a linked card's payment for that card, so a card matched by description can't also claim it", () => {
		const freedom = card('Freedom', 20, { matchRule: { matchText: 'chase credit crd', anyAmount: true } });
		const transactions = [cardPayment('2026-10-14', 800), transaction('2026-10-13', -800, CHECKING, { description: 'CHASE CREDIT CRD AUTOPAY' })];

		const ledger = ledgerOf('2026-10-15', [card('Sapphire', 20, { accountId: SAPPHIRE }), freedom], transactions, { [SAPPHIRE]: 0 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-20')).toMatchObject({ paid: true });
		expect(occurrenceOf(ledger, 'Freedom', '2026-10-20')).toMatchObject({ paid: false });
	});

	it("carry a statement due late last month that's still unpaid into this month", () => {
		const ledger = ledgerOf('2026-10-02', [card('Sapphire', 30, { accountId: SAPPHIRE })], [], { [SAPPHIRE]: 800 });

		expect(ledger.outstandingOccurrences.map(({ dueDate, carried, overdue }) => ({ dueDate, carried, overdue }))).toEqual([
			{ dueDate: '2026-09-30', carried: true, overdue: true },
			{ dueDate: '2026-10-30', carried: false, overdue: false }
		]);
	});

	it("drop last month's statement once it's paid, even late", () => {
		const ledger = ledgerOf('2026-10-08', [card('Sapphire', 30, { accountId: SAPPHIRE })], [cardPayment('2026-10-06', 800)], { [SAPPHIRE]: 0 });

		expect(ledger.outstandingOccurrences.map(occurrence => occurrence.dueDate)).toEqual(['2026-10-30']);
	});

	it("owe nothing on a card with a zero or credit balance, so it's settled instead of overdue", () => {
		for (const owed of [-150, 0]) {
			const ledger = ledgerOf('2026-10-25', [card('Sapphire', 20, { accountId: SAPPHIRE })], [], { [SAPPHIRE]: owed });
			expect(occurrenceOf(ledger, 'Sapphire', '2026-10-20')).toMatchObject({ amount: 0, paid: true, overdue: false });
		}
	});

	it("show a past month's unpaid statement at the card's balance, not $0", () => {
		const items = [card('Sapphire', 20, { accountId: SAPPHIRE })];
		const owed = { [SAPPHIRE]: 1200 };
		const calculator = calculatorOn('2026-10-15');
		const ledger = calculator.ledger({ trackingSince: '2026-01', recurringItems: items }, [], owed);

		const [september] = calculator.occurrencesFor({ trackingSince: '2026-01', recurringItems: items }, '2026-09', ledger, owed);
		expect(september).toMatchObject({ paid: false, amount: 1200 });
	});
});

describe('bills', () => {
	it('are paid by a payment up to ten days early', () => {
		const ledger = ledgerOf('2026-10-02', [bill('Rent', 1, 1500, 'landlord')], [transaction('2026-09-23', -1500, CHECKING, { description: 'LANDLORD' })]);

		expect(occurrenceOf(ledger, 'Rent', '2026-10-01')).toMatchObject({ paid: true, amount: 1500 });
	});

	it('show what was actually paid', () => {
		const ledger = ledgerOf('2026-10-20', [bill('Piano', 15, 100, 'maple')], [transaction('2026-10-16', -104, CHECKING, { description: 'MAPLE MUSIC' })]);

		expect(occurrenceOf(ledger, 'Piano', '2026-10-15')).toMatchObject({ paid: true, amount: 104 });
	});

	it('count a payment toward the due date whose cycle it falls in, and an extra payment toward the oldest unpaid due date', () => {
		const check = (date: string) => transaction(date, -100, CHECKING, { description: 'MAPLE MUSIC' });
		const ledger = ledgerOf('2026-10-20', [bill('Piano', 15, 100, 'maple', '2026-08')], [check('2026-10-03'), check('2026-10-16'), check('2026-10-18')]);

		// Oct 3 falls in September's cycle and Oct 16 in October's; Oct 18 is left over, so it pays August, the oldest still owed.
		expect(occurrenceOf(ledger, 'Piano', '2026-09-15')?.matchedTransaction?.date).toBe('2026-10-03');
		expect(occurrenceOf(ledger, 'Piano', '2026-10-15')?.matchedTransaction?.date).toBe('2026-10-16');
		expect(occurrenceOf(ledger, 'Piano', '2026-08-15')?.matchedTransaction?.date).toBe('2026-10-18');
	});

	it('leave an earlier month owed rather than move every later payment back a month', () => {
		const check = (date: string) => transaction(date, -100, CHECKING, { description: 'MAPLE MUSIC' });
		const ledger = ledgerOf('2026-10-20', [bill('Piano', 15, 100, 'maple', '2026-08')], [check('2026-09-16'), check('2026-10-16')]);

		expect(occurrenceOf(ledger, 'Piano', '2026-08-15')).toMatchObject({ paid: false, carried: true });
		expect(occurrenceOf(ledger, 'Piano', '2026-09-15')).toMatchObject({ paid: true });
		expect(occurrenceOf(ledger, 'Piano', '2026-10-15')).toMatchObject({ paid: true });
	});
});

describe('cards linked to a Monarch account', () => {
	it("aren't treated as owing nothing when Monarch has no balance for the account", () => {
		const ledger = ledgerOf('2026-10-25', [card('Sapphire', 20, { accountId: SAPPHIRE })], [], {});

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-20')).toMatchObject({ paid: false, overdue: true });
	});

	it('show as paid in history when they owed nothing', () => {
		const ledger = ledgerOf('2026-10-25', [card('Sapphire', 20, { accountId: SAPPHIRE })], [], { [SAPPHIRE]: 0 });

		expect(ledger.historiesByItemId.get('Sapphire')?.find(point => point.dueDate === '2026-10-20')).toMatchObject({ paid: true });
	});
});

describe("a linked card's payment from checking", () => {
	it('is only claimed by the card once, so a nearby bill for the same amount is still paid', () => {
		const rent = { ...bill('Rent', 1, 1500, 'landlord', '2026-01') };
		const transactions = [
			cardPayment('2026-10-01', 1500),
			transaction('2026-10-01', -1500, CHECKING, { description: 'CHASE CREDIT CRD AUTOPAY', category: { id: 'ccp', name: 'Credit Card Payment', icon: null, groupType: 'transfer' } }),
			transaction('2026-10-02', -1500, CHECKING, { description: 'ZELLE LANDLORD' })
		];

		const ledger = ledgerOf('2026-10-05', [card('Sapphire', 20, { accountId: SAPPHIRE }), rent], transactions, { [SAPPHIRE]: 0 });

		expect(occurrenceOf(ledger, 'Rent', '2026-10-01')?.paid).toBe(true);
	});
});

describe("a Monarch card's past months", () => {
	it("settle a statement paid a few days late once a later one is paid, instead of showing it owed at today's balance", () => {
		const today = '2026-10-02';
		const payments = [cardPayment('2026-08-29', 800), cardPayment('2026-09-24', 900)];
		const items = [card('Sapphire', 25, { accountId: SAPPHIRE })];
		const recurringData = { trackingSince: '2026-01', recurringItems: items };
		const ledger = calculatorOn(today).ledger(recurringData, payments, { [SAPPHIRE]: 1200 });

		const [august] = calculatorOn(today).occurrencesFor(recurringData, '2026-08', ledger, { [SAPPHIRE]: 1200 });

		expect(august).toMatchObject({ dueDate: '2026-08-25', paid: true, overdue: false, amount: 0 });
	});
});

describe('monthly history', () => {
	it("doesn't show months before tracking began as missed, but keeps payments found in them", () => {
		const internet = bill('Internet', 5, 60, 'comcast', '2026-09');
		const calculator = calculatorOn('2026-10-15');
		const ledger = calculator.ledger({ trackingSince: '2026-09', recurringItems: [internet] }, [transaction('2026-07-05', -60, CHECKING, { description: 'COMCAST' })], {});
		const history = calculator.monthlyHistory(ledger.historiesByItemId.get('Internet') ?? [], '2026-09');
		const byMonth = new Map(history.map(point => [point.month, point]));

		expect(byMonth.get('2026-07')).toMatchObject({ paid: true, amount: 60 });
		expect(byMonth.get('2026-08')).toMatchObject({ empty: true, untracked: true });
		expect(byMonth.get('2026-09')).toMatchObject({ paid: false, upcoming: false });
	});
});

describe('weekly bills', () => {
	it("match each week's payment to its own due date, leaving next week unpaid", () => {
		const cleaner: RecurringItem = { ...bill('Cleaner', 1, 300, 'cleaner', '2026-09'), recurrence: 'DTSTART:20260910T000000Z\nRRULE:FREQ=WEEKLY' };
		const payments = ['2026-09-24', '2026-10-01', '2026-10-08'].map(date => transaction(date, -300, CHECKING, { description: 'CLEANER' }));
		const ledger = calculatorOn('2026-10-09').ledger({ trackingSince: '2026-09', recurringItems: [cleaner] }, payments, {});

		expect(occurrenceOf(ledger, 'Cleaner', '2026-10-01')?.matchedTransaction?.date).toBe('2026-10-01');
		expect(occurrenceOf(ledger, 'Cleaner', '2026-10-08')?.matchedTransaction?.date).toBe('2026-10-08');
		expect(occurrenceOf(ledger, 'Cleaner', '2026-10-15')?.paid).toBe(false);
	});
});

describe('a schedule starting later', () => {
	it('owes nothing before its start, but still shows a payment made before it', () => {
		const gym = { ...bill('Gym', 5, 80, 'gym', '2026-10'), recurrence: 'DTSTART:20261105T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=5' };

		const unpaidLedger = ledgerOf('2026-10-20', [gym], []);
		expect(occurrenceOf(unpaidLedger, 'Gym', '2026-10-05')).toBeUndefined();

		const paidLedger = ledgerOf('2026-10-20', [gym], [transaction('2026-10-05', -80, CHECKING, { description: 'GYM' })]);
		expect(occurrenceOf(paidLedger, 'Gym', '2026-10-05')?.paid).toBe(true);
	});
});

describe("editing a bill's schedule", () => {
	it('still owes the months unpaid before the edit, when the new schedule starts later', () => {
		const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-03'));
		const recurrence = new RecurrenceCalculator(calendar);
		const kinds = new RecurringItemKindRegistry([new ManualBillKind(new TransactionMatcher(), new RecurringItemInferrer(recurrence), new Formatter(calendar))]);
		const factory = new RecurringItemFactory(calendar, recurrence, kinds);
		const rent = { ...bill('Rent', 10, 1500, 'landlord', '2026-01'), recurrence: monthly(10) };
		// The household picks Oct 10 as the next due date: the schedule now starts there.
		const edited = factory.itemFrom({ item: rent, schedule: { ...recurrence.fromRecurrence(rent.recurrence), start: '2026-10-10' } }, rent);

		const ledger = ledgerOf('2026-10-03', [edited], []);

		expect(ledger.outstandingOccurrences.map(occurrence => occurrence.dueDate)).toEqual(['2026-04-10', '2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10']);
	});

	it("resets when the edit changes the amount, since months paid at the old amount aren't owed at the new one", () => {
		const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-03'));
		const recurrence = new RecurrenceCalculator(calendar);
		const factory = new RecurringItemFactory(
			calendar,
			recurrence,
			new RecurringItemKindRegistry([new ManualBillKind(new TransactionMatcher(), new RecurringItemInferrer(recurrence), new Formatter(calendar))])
		);
		const rent = { ...bill('Rent', 1, 1000, 'landlord', '2026-01'), recurrence: monthly(1) };
		const paid = ['04', '05', '06', '07', '08', '09', '10'].map(month => transaction(`2026-${month}-01`, -1000, CHECKING, { description: 'LANDLORD' }));
		// The rent goes up from November.
		const raised = factory.itemFrom({ item: { ...rent, amount: 1150 }, schedule: { ...recurrence.fromRecurrence(rent.recurrence), start: '2026-11-01' } }, rent);

		expect(ledgerOf('2026-10-03', [raised], paid).outstandingOccurrences).toEqual([]);
	});

	it('still owes a due date unpaid on the day of the edit', () => {
		const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-01'));
		const recurrence = new RecurrenceCalculator(calendar);
		const factory = new RecurringItemFactory(
			calendar,
			recurrence,
			new RecurringItemKindRegistry([new ManualBillKind(new TransactionMatcher(), new RecurringItemInferrer(recurrence), new Formatter(calendar))])
		);
		const rent = { ...bill('Rent', 1, 1000, 'landlord', '2026-10'), recurrence: monthly(1) };
		const moved = factory.itemFrom({ item: rent, schedule: { ...recurrence.fromRecurrence(rent.recurrence), start: '2026-11-01' } }, rent);

		expect(ledgerOf('2026-10-01', [moved], []).outstandingOccurrences.map(occurrence => occurrence.dueDate)).toContain('2026-10-01');
	});

	it("doesn't owe the due dates an edit skipped, once they pass", () => {
		const calendarOnEditDay = new Calendar(() => Temporal.PlainDate.from('2026-10-03'));
		const recurrence = new RecurrenceCalculator(calendarOnEditDay);
		const factory = new RecurringItemFactory(
			calendarOnEditDay,
			recurrence,
			new RecurringItemKindRegistry([new ManualBillKind(new TransactionMatcher(), new RecurringItemInferrer(recurrence), new Formatter(calendarOnEditDay))])
		);
		const gym = { ...bill('Gym', 10, 80, 'gym', '2026-10'), recurrence: 'DTSTART:20261010T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=10' };
		// On Oct 3, before the first due date, the household moves the next one to Dec 10.
		const edited = factory.itemFrom({ item: gym, schedule: { ...recurrence.fromRecurrence(gym.recurrence), start: '2026-12-10' } }, gym);

		expect(ledgerOf('2026-11-12', [edited], []).outstandingOccurrences).toEqual([]);
	});

	it('owes nothing before the start of a new bill', () => {
		const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-03'));
		const recurrence = new RecurrenceCalculator(calendar);
		const factory = new RecurringItemFactory(
			calendar,
			recurrence,
			new RecurringItemKindRegistry([new ManualBillKind(new TransactionMatcher(), new RecurringItemInferrer(recurrence), new Formatter(calendar))])
		);
		const draft = factory.blankDraft('bill');
		const created = factory.itemFrom({
			item: { ...draft.item, name: 'Gym', amount: 80, matchRule: { matchText: 'gym' } },
			schedule: { ...recurrence.fromRecurrence(monthly(10)), start: '2026-10-10' }
		});

		expect(ledgerOf('2026-10-03', [created], []).outstandingOccurrences.map(occurrence => occurrence.dueDate)).toEqual(['2026-10-10']);
	});
});

describe('windows between due dates', () => {
	it("leave no gap between a twice-monthly card's payment windows", () => {
		const twiceMonthly = card('Loan', 1, { recurrence: 'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1,15', matchRule: { matchText: 'loan', anyAmount: true } });

		const ledger = ledgerOf('2026-10-02', [twiceMonthly], [transaction('2026-09-23', -100, CHECKING, { description: 'LOAN' })]);

		expect([occurrenceOf(ledger, 'Loan', '2026-09-15'), occurrenceOf(ledger, 'Loan', '2026-10-01')].some(occurrence => occurrence?.matchedTransaction?.date === '2026-09-23')).toBe(true);
	});

	it("don't owe anything before a late-starting schedule's start, once the start has passed", () => {
		const gym = { ...bill('Gym', 15, 80, 'gym', '2026-10'), recurrence: 'DTSTART:20261115T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15' };

		const ledger = ledgerOf('2026-11-16', [gym], []);

		expect(occurrenceOf(ledger, 'Gym', '2026-10-15')).toBeUndefined();
		expect(occurrenceOf(ledger, 'Gym', '2026-11-15')?.overdue).toBe(true);
	});
});

describe("payments early or late across a month's end", () => {
	it("counts a payment made early across the month's end for next month's due date", () => {
		const rent = bill('Rent', 1, 2000, 'landlord', '2026-10');
		const calculator = calculatorOn('2026-10-31');
		const ledger = calculator.ledger(
			{ trackingSince: '2026-10', recurringItems: [rent] },
			[transaction('2026-10-01', -2000, CHECKING, { description: 'LANDLORD' }), transaction('2026-10-30', -2000, CHECKING, { description: 'LANDLORD' })],
			{}
		);

		expect(occurrenceOf(ledger, 'Rent', '2026-11-01')?.paid).toBe(true);
		expect(calculator.occurrencesFor({ trackingSince: '2026-10', recurringItems: [rent] }, '2026-10', ledger, {}).map(occurrence => occurrence.dueDate)).not.toContain('2026-11-01');
		expect(calculator.occurrencesFor({ trackingSince: '2026-10', recurringItems: [rent] }, '2026-11', ledger, {})[0]?.paid).toBe(true);
	});

	it("doesn't let a due date before the schedule's start take a late payment from one after it", () => {
		const gym = { ...bill('Gym', 20, 80, 'gym', '2026-01'), recurrence: 'DTSTART:20261020T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=20' };
		const payments = ['2026-11-12', '2026-11-15'].map(date => transaction(date, -80, CHECKING, { description: 'GYM' }));

		const ledger = ledgerOf('2026-11-16', [gym], payments);

		expect(occurrenceOf(ledger, 'Gym', '2026-10-20')?.paid).toBe(true);
		expect(occurrenceOf(ledger, 'Gym', '2026-05-20')).toBeUndefined();
	});

	it("keeps each due date's own payment when a schedule's dates fall unevenly", () => {
		const unevenCard = card('Uneven', 1, { recurrence: 'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1,25', matchRule: { matchText: 'uneven', anyAmount: true } });
		const payments = ['2026-10-01', '2026-10-25'].map(date => transaction(date, -100, CHECKING, { description: 'UNEVEN' }));

		const ledger = ledgerOf('2026-10-27', [unevenCard], payments);

		expect(occurrenceOf(ledger, 'Uneven', '2026-10-01')?.matchedTransaction?.date).toBe('2026-10-01');
		expect(occurrenceOf(ledger, 'Uneven', '2026-10-25')?.matchedTransaction?.date).toBe('2026-10-25');
	});

	it("leaves months before a schedule's start out of its history, rather than showing them missed", () => {
		const moved = { ...bill('Moved', 15, 50, 'moved', '2026-01'), recurrence: 'DTSTART:20260815T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15' };
		const calculator = calculatorOn('2026-10-02');
		const data = { trackingSince: '2026-01', recurringItems: [moved] };
		const ledger = calculator.ledger(data, [], {});

		expect(ledger.historiesByItemId.get('Moved')?.map(point => point.dueDate)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
		expect(calculator.occurrencesFor(data, '2026-06', ledger, {})).toEqual([]);
	});
});

describe("a late or early payment's month", () => {
	it("applies a late payment to the month it was late for, not next month's early window", () => {
		const rent = bill('Rent', 5, 1500, 'landlord', '2026-10');
		const ledger = ledgerOf('2026-10-28', [rent], [transaction('2026-10-27', -1500, CHECKING, { description: 'LANDLORD' })]);

		expect(occurrenceOf(ledger, 'Rent', '2026-10-05')?.matchedTransaction?.date).toBe('2026-10-27');
		expect(occurrenceOf(ledger, 'Rent', '2026-11-05')).toBeUndefined();
	});

	it("keeps an early payment in its month's history over time", () => {
		const club = bill('Club', 5, 40, 'club', '2026-01');
		const payments = ['2026-01-05', '2026-02-27', '2026-04-05'].map(date => transaction(date, -40, CHECKING, { description: 'CLUB' }));
		const ledger = calculatorOn('2026-10-02').ledger({ trackingSince: '2026-01', recurringItems: [club] }, payments, {});
		const byMonth = new Map(ledger.historiesByItemId.get('Club')?.map(point => [point.month, point]));

		expect(byMonth.get('2026-02')?.paid).toBe(false);
		expect(byMonth.get('2026-03')?.paidDate).toBe('2026-02-27');
	});
});

describe('cards paid soon after their statement posts', () => {
	it('count each payment for the statement that closed before it, so none shows overdue', () => {
		const payments = ['2026-08-18', '2026-09-18'].map(date => cardPayment(date, 500));
		const ledger = ledgerOf('2026-10-12', [card('Sapphire', 10, { accountId: SAPPHIRE })], payments, { [SAPPHIRE]: 500 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-10')).toMatchObject({ paid: true, overdue: false });
		expect(occurrenceOf(ledger, 'Sapphire', '2026-09-10')).toMatchObject({ paid: true });
	});
});

describe('card payments around statement closes', () => {
	it('count a payment made just after a statement that closed a little early', () => {
		// Due the 30th; the statement closed 28 days before, on the 2nd, and was paid on the 3rd.
		const ledger = ledgerOf('2026-10-31', [card('Sapphire', 30, { accountId: SAPPHIRE })], [cardPayment('2026-10-03', 890)], { [SAPPHIRE]: 300 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-30')).toMatchObject({ paid: true });
	});

	it("settle a statement paid late, once the payment's been matched to the next one", () => {
		// Due the 9th; October's was paid a week late, after November's statement closed.
		const ledger = ledgerOf('2026-10-26', [card('Sapphire', 9, { accountId: SAPPHIRE })], [cardPayment('2026-09-08', 1000), cardPayment('2026-10-17', 1000)], { [SAPPHIRE]: 250 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-10-09')).toMatchObject({ paid: true, overdue: false });
	});
});

describe('payments the bank returns', () => {
	it("don't count as paying the statement", () => {
		const returned = transaction('2026-11-03', -1000, SAPPHIRE, { description: 'PAYMENT RETURNED', category: { id: 'ccp', name: 'Credit Card Payment', icon: null, groupType: 'transfer' } });
		const ledger = ledgerOf('2026-11-10', [card('Sapphire', 15, { accountId: SAPPHIRE })], [cardPayment('2026-11-01', 1000), returned], { [SAPPHIRE]: 1200 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-11-15')).toMatchObject({ paid: false });
	});
});

describe("a Monarch card's statement that closed owing nothing", () => {
	it('is settled with no amount shown, even though no payment was made', () => {
		const refund = transaction('2026-09-10', 300, SAPPHIRE, { description: 'STORE REFUND', category: { id: 'shopping', name: 'Shopping', icon: null, groupType: 'expense' } });
		const purchase = transaction('2026-09-25', -500, SAPPHIRE, { description: 'STORE' });
		// $300 was owed until the refund cleared it; the September 20 statement closed Aug 26 owing nothing, and $500 was charged since.
		const ledger = ledgerOf('2026-10-04', [card('Sapphire', 20, { accountId: SAPPHIRE })], [refund, purchase], { [SAPPHIRE]: 200 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-09-20')).toMatchObject({ paid: true, amount: 0 });
	});

	it("isn't assumed because of pending purchases the card's balance may not include yet", () => {
		const pendingPurchase = transaction('2026-10-03', -300, SAPPHIRE, { description: 'STORE', pending: true });
		// The September 20 statement closed owing the $300 the card still owes; the pending purchase isn't in that balance.
		const ledger = ledgerOf('2026-10-04', [card('Sapphire', 20, { accountId: SAPPHIRE })], [pendingPurchase], { [SAPPHIRE]: 300 });

		expect(occurrenceOf(ledger, 'Sapphire', '2026-09-20')).toMatchObject({ paid: false });
	});
});
