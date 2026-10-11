import type { Calendar } from '../../../../common/calendar';
import { ENDED_OCCURRENCE_STATUSES, MonarchOccurrenceStatus, MonarchRecurringType } from '../../../../monarch/api/models/monarchValues';
import { occurrenceAccountId, type RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import type { ExpectedIncomeKind } from '../../../recurring/expectedIncome/expectedIncomeKind';
import type { ManualBillKind } from '../../../recurring/manualBills/manualBillKind';
import type { Occurrence } from '../../../recurring/recurringItems/models/occurrence';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import type { RecurrenceCalculator } from '../../../recurring/recurringItems/services/recurrenceCalculator';
import type { RecurringPaymentCalculator } from '../../../recurring/recurringItems/services/recurringPaymentCalculator';
import type { ScheduledFlow } from '../models/projection';
import { OVERDUE_CARRY_MONTHS } from '../models/projectionHorizon';

const COUNTED_FLOW_TYPES: ReadonlySet<string> = new Set([MonarchRecurringType.expense, MonarchRecurringType.income]);

/** Which accounts a projection follows: checking as one pool, and the cards. */
export interface ProjectedAccounts {
	checkingAccountIds: ReadonlySet<string>;
	cardAccountIds: ReadonlySet<string>;
}

/**
 * Monarch's recurring income and expenses, and Wingspan's bills and income, from today to the end date.
 * Flows through checking have no accountId; flows on a card keep the card's id. Flows on any other account are left out.
 */
export class ScheduledFlowBuilder {
	public constructor(
		private readonly calendar: Calendar,
		private readonly recurrence: RecurrenceCalculator,
		private readonly payments: RecurringPaymentCalculator,
		private readonly manualBills: ManualBillKind,
		private readonly expectedIncome: ExpectedIncomeKind
	) {}

	/** Monarch's flows, then Wingspan's bills and income, unsorted. dueDayByRecurrenceId moves an item that's due once in a month to the household's chosen day. */
	public flows(
		recurringFlows: RecurringFlow[],
		outstandingOccurrences: Occurrence[],
		recurringItems: RecurringItem[],
		accounts: ProjectedAccounts,
		dueDayByRecurrenceId: Readonly<Record<string, number>>,
		endDate: string
	): ScheduledFlow[] {
		return [
			...this.monarchFlows(recurringFlows, accounts, dueDayByRecurrenceId, endDate),
			...this.billFlows(outstandingOccurrences, recurringItems, accounts, endDate),
			...this.incomeFlows(outstandingOccurrences, recurringItems, accounts, endDate)
		];
	}

	/**
	 * Monarch's recurring items, on the household's own due day for one due once that month. A past-due expense moves to
	 * today if it's this month's and not ended, or an earlier month's still overdue; past-due income isn't coming.
	 */
	private monarchFlows(recurringFlows: RecurringFlow[], accounts: ProjectedAccounts, dueDayByRecurrenceId: Readonly<Record<string, number>>, endDate: string): ScheduledFlow[] {
		const today = this.calendar.today();
		const monthStart = `${this.calendar.currentMonth()}-01`;
		const carryStart = `${this.calendar.addMonths(this.calendar.currentMonth(), -OVERDUE_CARRY_MONTHS)}-01`;
		const flows: ScheduledFlow[] = [];

		for (const flow of recurringFlows) {
			const { recurrenceGroup, occurrences } = flow;
			if (!COUNTED_FLOW_TYPES.has(recurrenceGroup.recurringType)) continue;
			const dueDay = dueDayByRecurrenceId[recurrenceGroup.id];
			// Count all occurrences, including other parts', to decide if it's due once that month, so every part moves it the same way.
			const occurrencesByMonth = Map.groupBy(flow.allOccurrences ?? occurrences, occurrence => this.calendar.monthOf(occurrence.date));

			for (const occurrence of occurrences) {
				const amount = occurrence.amount ?? recurrenceGroup.amount;
				const projectedAccount = this.projectedAccount(occurrenceAccountId(flow, occurrence), accounts);
				const month = this.calendar.monthOf(occurrence.date);
				const isOnceInMonth = (occurrencesByMonth.get(month)?.length ?? 0) === 1;
				const date = dueDay && isOnceInMonth ? this.calendar.dayInMonth(month, dueDay) : occurrence.date;
				if (occurrence.status === MonarchOccurrenceStatus.paid || !amount || projectedAccount === null || date > endDate) continue;
				if (date < today && amount > 0) continue;
				if (occurrence.date < today && ENDED_OCCURRENCE_STATUSES.has(occurrence.status)) continue;
				if (occurrence.date < monthStart && (occurrence.status !== MonarchOccurrenceStatus.overdue || occurrence.date < carryStart)) continue;

				flows.push({
					date: date < today ? today : date,
					amount,
					label: recurrenceGroup.name,
					kind: recurrenceGroup.recurringType === MonarchRecurringType.income ? 'income' : 'bill',
					accountId: projectedAccount
				});
			}
		}

		return flows;
	}

	/** Bills still owed, due today at the latest, and each bill's further due dates. A bill with no account is paid from checking. */
	private billFlows(outstandingOccurrences: Occurrence[], recurringItems: RecurringItem[], accounts: ProjectedAccounts, endDate: string): ScheduledFlow[] {
		const today = this.calendar.today();
		const flows: ScheduledFlow[] = [];

		for (const occurrence of outstandingOccurrences) {
			const projectedAccount = this.projectedAccount(occurrence.item.matchRule?.accountId, accounts);
			if (!this.manualBills.owns(occurrence.item) || occurrence.paid || projectedAccount === null) continue;
			flows.push({ date: occurrence.dueDate < today ? today : occurrence.dueDate, amount: -occurrence.amount, label: occurrence.item.name, kind: 'bill', accountId: projectedAccount });
		}

		const listedKeys = new Set(outstandingOccurrences.map(occurrence => occurrence.key));
		const tomorrow = this.calendar.addDays(today, 1);
		for (const item of recurringItems) {
			const projectedAccount = this.projectedAccount(item.matchRule?.accountId, accounts);
			if (!this.manualBills.owns(item) || !item.active || projectedAccount === null) continue;

			for (const dueDate of this.recurrence.dueDates(item.recurrence, tomorrow, endDate)) {
				if (!listedKeys.has(this.payments.occurrenceKey(item.id, dueDate))) flows.push({ date: dueDate, amount: -item.amount, label: item.name, kind: 'bill', accountId: projectedAccount });
			}
		}

		return flows;
	}

	/**
	 * Each income's expected amount on every due date after today, and today too if nothing has arrived yet. The amount
	 * is an estimate, so a deposit already in the balance doesn't reduce later due dates. Income that missed an earlier
	 * due date isn't coming.
	 */
	private incomeFlows(outstandingOccurrences: Occurrence[], recurringItems: RecurringItem[], accounts: ProjectedAccounts, endDate: string): ScheduledFlow[] {
		const today = this.calendar.today();
		const flows: ScheduledFlow[] = [];
		const receivedTodayIds = new Set(outstandingOccurrences.filter(occurrence => occurrence.dueDate === today && occurrence.paid).map(occurrence => occurrence.item.id));

		for (const item of recurringItems) {
			const projectedAccount = this.projectedAccount(item.matchRule?.accountId, accounts);
			if (!this.expectedIncome.owns(item) || !item.active || projectedAccount === null) continue;

			const fromDate = receivedTodayIds.has(item.id) ? this.calendar.addDays(today, 1) : today;
			for (const dueDate of this.recurrence.dueDates(item.recurrence, fromDate, endDate)) {
				flows.push({ date: dueDate, amount: item.amount, label: item.name, kind: 'income', accountId: projectedAccount });
			}
		}

		return flows;
	}

	/** Undefined for checking, the card's id for a card, null for an account the projection doesn't follow. */
	private projectedAccount(accountId: string | undefined, accounts: ProjectedAccounts): string | undefined | null {
		if (!accountId || accounts.checkingAccountIds.has(accountId)) return undefined;
		return accounts.cardAccountIds.has(accountId) ? accountId : null;
	}
}
