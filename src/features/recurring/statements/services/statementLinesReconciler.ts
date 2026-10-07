import type { Calendar } from '../../../../common/calendar';
import { CENT_TOLERANCE } from '../../../../common/money';
import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import type { RecurringView } from '../../../../monarch/pages/recurringV2/models/recurringView';
import type { RecurringItemKindRegistry } from '../../recurringItems/kinds/recurringItemKindRegistry';
import type { HistoryPoint } from '../../recurringItems/models/historyPoint';
import type { RecurringItem } from '../../recurringItems/models/recurringItem';
import type { RecurringLine } from '../../recurringItems/models/recurringLine';
import type { PlannedCardPayment } from '../models/cardPaymentPlans';

export interface StatementLinesInput {
	lines: RecurringLine[];
	view: RecurringView;
	/** The month being viewed. A past month shows what was true then, not what today's projection says. */
	month: string;
	plansByItemId: ReadonlyMap<string, PlannedCardPayment[]>;
	owedByAccountId: BalancesByAccountId;
}

/**
 * Updates a Monarch card's lines to agree with its projection, since matching payments can't tell a partial payment
 * from a full one. A line is marked paid only when the projection shows nothing left on it.
 */
export class StatementLinesReconciler {
	public constructor(
		private readonly calendar: Calendar,
		private readonly kinds: RecurringItemKindRegistry
	) {}

	/** Leaves the All view and past months unchanged. */
	public reconcile({ lines, view, month, plansByItemId, owedByAccountId }: StatementLinesInput): RecurringLine[] {
		if (view !== 'month' || month < this.calendar.currentMonth()) return lines;
		const today = this.calendar.today();
		// A newer statement that's already due includes the older ones, so they're covered by it instead of counted as extra owed.
		const latestDueByItemId = new Map<string, string>();
		for (const line of lines) {
			if (!this.kinds.isLinked(line.item) || line.dueDate > today) continue;
			if (line.dueDate > (latestDueByItemId.get(line.item.id) ?? '')) latestDueByItemId.set(line.item.id, line.dueDate);
		}

		return lines
			.filter(line => line.paid || line.dueDate >= (latestDueByItemId.get(line.item.id) ?? ''))
			.map(line => {
				const accountId = this.kinds.linkedAccountId(line.item);
				const plans = plansByItemId.get(line.item.id);
				if (accountId === undefined || !plans) return line;
				const leftToPay = this.planFor(line.dueDate, plans);
				// Every due date of a linked card is in its plan, so a due date the plan has no payment for owes nothing.
				const owesNothing = !leftToPay || leftToPay.owed <= CENT_TOLERANCE;
				// If the amount is unknown, an empty plan doesn't mean nothing is owed.
				if (!line.paid && owesNothing && !line.amountUnknown) return this.settled(line);
				if (line.paid && !owesNothing) return this.stillOwed(line, owedByAccountId[accountId] ?? leftToPay.owed);
				return line;
			});
	}

	/** For a card's payment history: a past statement the projection shows nothing left on isn't owed, paid or not. */
	public reconcileHistory(item: RecurringItem, points: HistoryPoint[], plans: PlannedCardPayment[] | undefined): HistoryPoint[] {
		if (!this.kinds.isLinked(item) || !plans) return points;
		const today = this.calendar.today();
		const leftToday = this.planFor(today, plans);
		if (leftToday && leftToday.owed > CENT_TOLERANCE) return points;
		return points.map(point => (point.paid || point.dueDate > today ? point : { ...point, paid: true }));
	}

	/** The plan for a due date. A due date that has already passed is planned for today. */
	public planFor(dueDate: string, plans: PlannedCardPayment[]): PlannedCardPayment | undefined {
		const today = this.calendar.today();
		const planDate = dueDate <= today ? today : dueDate;
		return plans.find(payment => payment.date === planDate);
	}

	/** Settled without a payment. Nothing is shown next to it, since the balance belongs to the next statement. */
	private settled(line: RecurringLine): RecurringLine {
		const occurrences = line.occurrences.map(occurrence => ({ ...occurrence, paid: true, overdue: false, amount: 0 }));
		return { ...line, paid: true, overdue: false, occurrences, amount: 0 };
	}

	/** A payment was matched but the statement still has a balance, so it's still due and owes the card's balance like any unpaid statement. */
	private stillOwed(line: RecurringLine, balance: number): RecurringLine {
		const overdue = line.dueDate < this.calendar.today();
		const occurrences = line.occurrences.map(occurrence => (occurrence.dueDate === line.dueDate ? { ...occurrence, paid: false, overdue, amount: balance } : occurrence));
		return { ...line, paid: false, overdue, occurrences, amount: balance };
	}
}
