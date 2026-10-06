import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { Formatter } from '../../../../monarch/ui/formatter';
import { ManualBillKind } from '../../manualBills/manualBillKind';
import { RecurringItemInferrer } from '../../manualBills/services/recurringItemInferrer';
import { RecurringItemKindRegistry } from '../../recurringItems/kinds/recurringItemKindRegistry';
import type { RecurringItem } from '../../recurringItems/models/recurringItem';
import type { RecurringLine } from '../../recurringItems/models/recurringLine';
import { RecurrenceCalculator } from '../../recurringItems/services/recurrenceCalculator';
import { TransactionMatcher } from '../../recurringItems/services/transactionMatcher';
import { CardPaymentKind } from '../cardPaymentKind';
import type { PlannedCardPayment } from '../models/cardPaymentPlans';
import { StatementLinesReconciler } from './statementLinesReconciler';

const TODAY = '2026-10-20';
const calendar = new Calendar(() => Temporal.PlainDate.from(TODAY));
const matcher = new TransactionMatcher();
const kinds = new RecurringItemKindRegistry([new ManualBillKind(matcher, new RecurringItemInferrer(new RecurrenceCalculator(calendar)), new Formatter(calendar)), new CardPaymentKind(matcher)]);
const reconciler = new StatementLinesReconciler(calendar, kinds);

const card: RecurringItem & { accountId: string } = {
	id: 'card',
	kind: 'card',
	name: 'Card',
	recurrence: 'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15',
	amount: 0,
	active: true,
	since: '2026-01',
	accountId: 'acct'
};
const lineOn = (dueDate: string, paid: boolean, amount = 400): RecurringLine => ({
	item: card,
	key: `card@${dueDate}`,
	occurrences: [{ item: card, dueDate, key: `card@${dueDate}`, amount, paid, matchedTransaction: null, carried: dueDate < '2026-10-01', overdue: !paid && dueDate < TODAY }],
	dueDate,
	paid,
	overdue: !paid && dueDate < TODAY,
	carried: dueDate < '2026-10-01',
	amount,
	lastPaidDate: null,
	nextDueDate: null
});
const plan = (date: string, owed: number): PlannedCardPayment => ({ date, amount: owed, owed, minimum: null, minimumIsEstimated: false });
const reconcile = (lines: RecurringLine[], plans: PlannedCardPayment[], month = '2026-10') =>
	reconciler.reconcile({ lines, view: 'month', month, plansByItemId: new Map([['card', plans]]), owedByAccountId: { acct: 400 } });

describe("a Monarch card's lines", () => {
	it('settle a statement with no matched payment when the projection shows nothing left on it, with no amount shown', () => {
		const [line] = reconcile([lineOn('2026-10-15', false)], [plan('2026-11-15', 400)]);

		expect(line).toMatchObject({ paid: true, overdue: false, amount: 0 });
	});

	it("don't settle a statement when Monarch has no balance for the card, since an empty plan means unknown, not $0", () => {
		const [line] = reconcile([{ ...lineOn('2026-10-15', false, 0), amountUnknown: true }], [plan('2026-11-15', 0)]);

		expect(line).toMatchObject({ paid: false, overdue: true });
	});

	it('keep a statement with a matched payment as owed while the projection shows a balance left', () => {
		const [line] = reconcile([lineOn('2026-10-15', true, 100)], [plan(TODAY, 300)]);

		expect(line).toMatchObject({ paid: false, overdue: true, amount: 400 });
	});

	it('settle an upcoming statement the projection has no payment for', () => {
		const [line] = reconcile([lineOn('2026-10-28', false)], [plan('2026-11-28', 400)]);

		expect(line).toMatchObject({ paid: true, amount: 0 });
	});

	it('roll an older unpaid statement into the newer one already due, instead of counting it as extra owed', () => {
		const lines = reconcile([lineOn('2026-09-15', false), lineOn('2026-10-15', false)], [plan(TODAY, 800)]);

		expect(lines.map(line => line.dueDate)).toEqual(['2026-10-15']);
		expect(lines[0]).toMatchObject({ paid: false, overdue: true });
	});

	it('leave lines alone until the projection has a plan for the card', () => {
		const line = lineOn('2026-10-15', false);

		expect(reconciler.reconcile({ lines: [line], view: 'month', month: '2026-10', plansByItemId: new Map(), owedByAccountId: {} })).toEqual([line]);
	});

	it("leave a past month unchanged instead of using today's balance", () => {
		const september = lineOn('2026-09-15', true, 500);

		expect(reconcile([september], [plan(TODAY, 800)], '2026-09')).toEqual([september]);
	});

	it('mark a past statement as not owed in the payment history when the projection shows nothing left on it', () => {
		const points = [{ month: '2026-10', dueDate: '2026-10-15', paid: false, amount: null, paidDate: null, upcoming: false, transaction: null }];

		expect(reconciler.reconcileHistory(card, points, [plan('2026-11-15', 400)])[0]?.paid).toBe(true);
		expect(reconciler.reconcileHistory(card, points, [plan(TODAY, 400)])[0]?.paid).toBe(false);
	});
});
