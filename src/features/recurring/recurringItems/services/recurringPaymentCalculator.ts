import type { Calendar } from '../../../../common/calendar';
import { CENT_TOLERANCE } from '../../../../common/money';
import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import { TRANSFER_GROUP_TYPES } from '../../../../monarch/api/models/monarchValues';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE, STATEMENT_CLOSE_DAYS_BEFORE_DUE } from '../../statements/models/statementCycle';
import type { RecurringItemKindRegistry } from '../kinds/recurringItemKindRegistry';
import type { HistoryPoint } from '../models/historyPoint';
import type { Occurrence } from '../models/occurrence';
import type { PaymentLedger } from '../models/paymentLedger';
import type { RecurringData } from '../models/recurringData';
import type { RecurringItem } from '../models/recurringItem';
import type { RecurrenceCalculator } from './recurrenceCalculator';

/** How far ahead of its due date a payment still counts for it. */
const EARLY_PAYMENT_DAYS = 10;
/** Linked card payments and their checking side post within a few days of each other. */
const TRANSFER_PAIR_DAYS = 3;
const HISTORY_CUTOFF_DAYS = 4;
const FAR_FUTURE_DAYS = 800;
const HISTORY_MONTHS = 12;

interface PaymentSearch {
	withinCycle: boolean;
	latestDate?: string;
}

/** Matches Monarch's transactions to recurring items' due dates. */
export class RecurringPaymentCalculator {
	public constructor(
		private readonly calendar: Calendar,
		private readonly recurrence: RecurrenceCalculator,
		private readonly kinds: RecurringItemKindRegistry
	) {}

	/** Key for one due date of one item, used in the ledger and on the page. */
	public occurrenceKey(itemId: string, dueDate: string): string {
		return `${itemId}@${dueDate}`;
	}

	/** Every transaction the item's kind counts as its payment, whatever due date it's for. */
	public matchingTransactions(item: RecurringItem, transactions: Transaction[]): Transaction[] {
		const kind = this.kinds.of(item);
		const fitsRule = kind.paymentRule(item);
		if (!fitsRule) return [];
		const payments = transactions.filter(fitsRule);
		return kind.paymentsThatStood ? kind.paymentsThatStood(item, payments, transactions) : payments;
	}

	/** Matches payments to due dates for every item at once, so no payment pays two. */
	public ledger(recurringData: RecurringData, transactions: Transaction[], owedByAccountId: BalancesByAccountId): PaymentLedger {
		const candidatesByItemId = this.candidatesByItemId(recurringData.recurringItems, transactions);
		const settledOccurrences = this.allocate(recurringData, candidatesByItemId, owedByAccountId, transactions);
		const settledByKey = new Map(settledOccurrences.map(occurrence => [occurrence.key, occurrence]));
		const settledTransactionIds = new Set(settledOccurrences.flatMap(occurrence => (occurrence.matchedTransaction ? [occurrence.matchedTransaction.id] : [])));
		const historyUsedTransactionIds = new Set(settledTransactionIds);
		const historiesByItemId = new Map(recurringData.recurringItems.map(item => [item.id, this.historyOf(item, candidatesByItemId.get(item.id) ?? [], settledByKey, historyUsedTransactionIds)]));

		return {
			settledOccurrences,
			settledByKey,
			outstandingOccurrences: settledOccurrences.filter(occurrence => !occurrence.carried || !occurrence.paid),
			historiesByItemId
		};
	}

	/** Before `trackingSince`, only found payments are shown. A month with no payment wasn't being tracked, so it isn't shown as missed. */
	public monthlyHistory(points: HistoryPoint[], trackingSince: string): HistoryPoint[] {
		const currentMonth = this.calendar.currentMonth();
		const pointsByMonth = Map.groupBy(
			points.filter(point => point.paid || point.month >= trackingSince),
			point => point.month
		);

		return Array.from({ length: HISTORY_MONTHS }, (_, index) => this.calendar.addMonths(currentMonth, index - (HISTORY_MONTHS - 1))).map((month): HistoryPoint => {
			const monthPoints = pointsByMonth.get(month) ?? [];
			const firstPoint = monthPoints[0];
			if (!firstPoint) return { month, dueDate: `${month}-01`, paid: false, amount: null, paidDate: null, upcoming: false, transaction: null, empty: true, untracked: month < trackingSince };

			const paidPoints = monthPoints.filter(point => point.paid);
			const pastPoints = monthPoints.filter(point => !point.upcoming);
			return {
				month,
				dueDate: firstPoint.dueDate,
				paid: pastPoints.length > 0 && pastPoints.every(point => point.paid),
				amount: paidPoints.length ? paidPoints.reduce((total, point) => total + (point.amount ?? 0), 0) : null,
				paidDate: paidPoints.at(-1)?.paidDate ?? null,
				upcoming: pastPoints.length === 0,
				transaction: null
			};
		});
	}

	/** All items' due dates in `month`: the current month from the ledger with carried debts, past months from up to a year of history, and future months as expected. */
	public occurrencesFor(recurringData: RecurringData, month: string, ledger: PaymentLedger, owedByAccountId: BalancesByAccountId): Occurrence[] {
		const currentMonth = this.calendar.currentMonth();
		if (month === currentMonth) return ledger.outstandingOccurrences.filter(occurrence => occurrence.dueDate <= this.calendar.lastOfMonth(month));
		if (month < this.calendar.addMonths(currentMonth, -(HISTORY_MONTHS - 1))) return [];

		return recurringData.recurringItems
			.filter(item => this.trackingFloor(item, recurringData) <= month)
			.flatMap(item =>
				this.dueDatesFor(item, `${month}-01`, this.calendar.lastOfMonth(month)).flatMap(dueDate => {
					const settledOccurrence = ledger.settledByKey.get(this.occurrenceKey(item.id, dueDate));
					// Next month's due date shows as paid if it was paid early.
					if (month > currentMonth) return [settledOccurrence ?? this.occurrence(item, dueDate, null, this.kinds.of(item).expectedAmount(item, owedByAccountId), false)];

					// Use the ledger's status for the months it covers, e.g. a card that owed nothing is settled.
					if (settledOccurrence) return [{ ...settledOccurrence, carried: false }];
					const history = ledger.historiesByItemId.get(item.id) ?? [];
					const transaction = history.find(point => point.dueDate === dueDate)?.transaction ?? null;
					if (!transaction && this.isBeforeStart(item, dueDate)) return [];
					// A Monarch card's later statement includes this one, same as in the ledger: once it's paid, this one is settled.
					const isSettledByLater = this.kinds.isLinked(item) && history.some(point => point.paid && point.dueDate > dueDate);
					if (!transaction && isSettledByLater) return [this.occurrence(item, dueDate, null, 0, false, true)];
					return [this.occurrence(item, dueDate, transaction, this.kinds.of(item).occurrenceAmount(item, transaction, owedByAccountId), false)];
				})
			)
			.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
	}

	/** The month an item's tracking starts: when it was added or tracking began, whichever is later. */
	public trackingFloor(item: RecurringItem, recurringData: RecurringData): string {
		return item.since > recurringData.trackingSince ? item.since : recurringData.trackingSince;
	}

	private dueDatesFor(item: RecurringItem, fromDate: string, toDate: string): string[] {
		if (!item.active) return [];
		return this.recurrence.dueDates(item.recurrence, fromDate, toDate);
	}

	/** Each payment settles at most one occurrence. */
	private allocate(recurringData: RecurringData, candidatesByItemId: Map<string, Transaction[]>, owedByAccountId: BalancesByAccountId, transactions: Transaction[]): Occurrence[] {
		const currentMonth = this.calendar.currentMonth();
		const monthStart = `${currentMonth}-01`;
		const monthEnd = this.calendar.lastOfMonth(currentMonth);
		const usedTransactionIds = new Set<string>();
		const dueDates = recurringData.recurringItems
			.flatMap(item => {
				const floorDate = `${this.trackingFloor(item, recurringData)}-01`;
				const lookbackDate = `${this.calendar.addMonths(currentMonth, -this.kinds.of(item).unpaidCarryMonths)}-01`;
				const fromDate = lookbackDate > floorDate ? lookbackDate : floorDate;
				return this.dueDatesFor(item, fromDate, this.allocatedThrough(item)).map(dueDate => ({ item, dueDate }));
			})
			.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

		// Past due dates are matched first, within their own cycle and then to late payments, oldest first, so a late
		// payment settles the debt it was for. Only then are upcoming due dates matched to early payments.
		const today = this.calendar.today();
		const matches: (Transaction | null)[] = dueDates.map(() => null);
		const matchWithinCycle = (isDue: boolean) => {
			for (const [index, { item, dueDate }] of dueDates.entries()) {
				if (dueDate <= today === isDue) matches[index] = this.findMatch(item, dueDate, candidatesByItemId.get(item.id) ?? [], usedTransactionIds, { withinCycle: true });
			}
		};
		matchWithinCycle(true);
		for (const [index, { item, dueDate }] of dueDates.entries()) {
			// A due date before the schedule's start isn't owed, so it shouldn't take a late payment meant for one that is.
			if (dueDate > today || matches[index] || this.kinds.of(item).paymentWindow !== 'afterDueDate' || this.isBeforeStart(item, dueDate)) continue;
			matches[index] = this.findMatch(item, dueDate, candidatesByItemId.get(item.id) ?? [], usedTransactionIds, { withinCycle: false });
		}
		matchWithinCycle(false);

		// A Monarch card's later statement includes the earlier ones, so paying it also settles the ones before it.
		const latestPaidByLinkedItem = new Map<string, string>();
		for (const [index, { item, dueDate }] of dueDates.entries()) {
			if (matches[index] && this.kinds.isLinked(item) && dueDate > (latestPaidByLinkedItem.get(item.id) ?? '')) latestPaidByLinkedItem.set(item.id, dueDate);
		}
		const isSettledByLater = (item: RecurringItem, dueDate: string) => dueDate < (latestPaidByLinkedItem.get(item.id) ?? '');

		// Nothing before a schedule's start is owed, whether or not the start has passed, but a payment made before it still shows.
		return dueDates.flatMap(({ item, dueDate }, index) => {
			const matchedTransaction = matches[index] ?? null;
			if (!matchedTransaction && (this.isBeforeStart(item, dueDate) || dueDate > monthEnd)) return [];
			const amount = this.kinds.of(item).occurrenceAmount(item, matchedTransaction, owedByAccountId);
			// Settled by a later statement, or closed owing nothing. No amount is shown since the card's balance belongs to a later statement.
			const isSettledWithoutOwing = !matchedTransaction && (isSettledByLater(item, dueDate) || this.closedOwingNothing(item, dueDate, owedByAccountId, transactions));
			const isSettled = !matchedTransaction && (this.owesNothing(item, owedByAccountId) || isSettledWithoutOwing);
			const shownAmount = isSettledWithoutOwing ? 0 : amount;
			return [this.occurrence(item, dueDate, matchedTransaction, shownAmount, dueDate < monthStart, isSettled)];
		});
	}

	/** Extends past the end of the month only as far as an early payment could already have been made. For a Monarch card, that's back to when its statement closed. */
	private allocatedThrough(item: RecurringItem): string {
		const monthEnd = this.calendar.lastOfMonth(this.calendar.currentMonth());
		const earlyDays = this.kinds.isLinked(item) ? PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE : EARLY_PAYMENT_DAYS;
		const earlyPaidThrough = this.calendar.addDays(this.calendar.today(), earlyDays);
		return earlyPaidThrough > monthEnd ? earlyPaidThrough : monthEnd;
	}

	private isBeforeStart(item: RecurringItem, dueDate: string): boolean {
		if (dueDate >= this.recurrence.startOf(item.recurrence)) return false;
		return !item.owedSpans?.some(span => dueDate >= span.from && dueDate < span.before);
	}

	/**
	 * A Monarch card's past statement that closed owing nothing, e.g. one cleared by refunds. The card's balance at the
	 * close, calculated back from today's balance through everything posted since, was $0.
	 */
	private closedOwingNothing(item: RecurringItem, dueDate: string, owedByAccountId: BalancesByAccountId, transactions: Transaction[]): boolean {
		const accountId = this.kinds.linkedAccountId(item);
		const owedToday = accountId === undefined ? undefined : owedByAccountId[accountId];
		if (owedToday === undefined || dueDate > this.calendar.today()) return false;
		const closeDate = this.calendar.addDays(dueDate, -STATEMENT_CLOSE_DAYS_BEFORE_DUE);
		// Skip pending transactions: if the balance doesn't include them, they'd make the statement look paid down sooner than it was.
		const postedSinceClose = transactions
			.filter(transaction => !transaction.pending && transaction.accountId === accountId && transaction.date > closeDate)
			.reduce((total, transaction) => total + transaction.amount, 0);
		return owedToday + postedSinceClose < CENT_TOLERANCE;
	}

	/** A card linked to an account Monarch shows as owing nothing. If the account has no balance, it isn't assumed to owe nothing. */
	private owesNothing(item: RecurringItem, owedByAccountId: BalancesByAccountId): boolean {
		const accountId = this.kinds.linkedAccountId(item);
		const owed = accountId === undefined ? undefined : owedByAccountId[accountId];
		return owed !== undefined && owed < CENT_TOLERANCE;
	}

	/**
	 * Each item's possible payments. When a linked card is paid, the checking side of that transfer is reserved for the
	 * card, so an item matched by description, like another card from the same issuer, can't also claim it.
	 */
	private candidatesByItemId(items: RecurringItem[], transactions: Transaction[]): Map<string, Transaction[]> {
		const candidatesByItemId = new Map(items.map(item => [item.id, this.matchingTransactions(item, transactions)]));
		const linkedItems = items.filter(item => this.kinds.isLinked(item));
		const otherSideIds = this.transferOtherSides(
			linkedItems.flatMap(item => candidatesByItemId.get(item.id) ?? []),
			transactions
		);

		for (const item of items) {
			if (linkedItems.includes(item)) continue;
			candidatesByItemId.set(
				item.id,
				(candidatesByItemId.get(item.id) ?? []).filter(transaction => !otherSideIds.has(transaction.id))
			);
		}
		return candidatesByItemId;
	}

	/**
	 * The outflow each card payment came from: same amount, on another account, within a few days. Transfers are
	 * preferred, then the closest date, so a nearby bill for the same amount, like rent, stays matched to the bill.
	 */
	private transferOtherSides(cardPayments: Transaction[], transactions: Transaction[]): Set<string> {
		const claimedIds = new Set<string>();
		const isTransfer = (transaction: Transaction) => TRANSFER_GROUP_TYPES.has(transaction.category?.groupType ?? '');
		const outflows = transactions.filter(transaction => transaction.amount < 0);
		// Dedupe, since two items on one card would list its payments twice.
		const uniquePayments = [...new Map(cardPayments.map(payment => [payment.id, payment])).values()];
		for (const payment of uniquePayments.toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
			const daysFrom = (transaction: Transaction) => Math.abs(this.calendar.daysBetween(payment.date, transaction.date));
			const [otherSide] = outflows
				.filter(
					transaction =>
						!claimedIds.has(transaction.id) &&
						transaction.accountId !== payment.accountId &&
						Math.abs(payment.amount + transaction.amount) < CENT_TOLERANCE &&
						daysFrom(transaction) <= TRANSFER_PAIR_DAYS
				)
				.toSorted((a, b) => Number(isTransfer(b)) - Number(isTransfer(a)) || daysFrom(a) - daysFrom(b) || a.id.localeCompare(b.id));
			if (otherSide) claimedIds.add(otherSide.id);
		}
		return claimedIds;
	}

	// Looks back before the item was added, since earlier payments are already in Monarch. Items share `usedTransactionIds` so no two items claim the same payment.
	private historyOf(item: RecurringItem, candidates: Transaction[], settledByKey: ReadonlyMap<string, Occurrence>, usedTransactionIds: Set<string>): HistoryPoint[] {
		const today = this.calendar.today();
		const currentMonth = this.calendar.monthOf(today);
		const fromDate = `${this.calendar.addMonths(currentMonth, -(HISTORY_MONTHS - 1))}-01`;
		const monthEnd = this.calendar.lastOfMonth(currentMonth);

		// For months outside the ledger, use the same two passes: each due date's own cycle first, then late payments, oldest first.
		const dueDates = this.dueDatesFor(item, fromDate, this.allocatedThrough(item));
		const transactions = dueDates.map(dueDate => {
			const settledOccurrence = settledByKey.get(this.occurrenceKey(item.id, dueDate));
			if (settledOccurrence) return settledOccurrence.matchedTransaction;
			return dueDate > today ? null : this.findMatch(item, dueDate, candidates, usedTransactionIds, { withinCycle: true });
		});
		for (const [index, dueDate] of dueDates.entries()) {
			if (transactions[index] || dueDate > today || settledByKey.has(this.occurrenceKey(item.id, dueDate))) continue;
			// A payment counts for this due date only until shortly before the next one.
			const nextDueDate = this.recurrence.nextDue(item.recurrence, dueDate) ?? this.calendar.addDays(dueDate, FAR_FUTURE_DAYS);
			const cutoffDate = this.calendar.addDays(nextDueDate, -HISTORY_CUTOFF_DAYS);
			transactions[index] = this.findMatch(item, dueDate, candidates, usedTransactionIds, { withinCycle: false, latestDate: cutoffDate < today ? cutoffDate : today });
		}

		return dueDates.flatMap((dueDate, index): HistoryPoint[] => {
			const settledOccurrence = settledByKey.get(this.occurrenceKey(item.id, dueDate));
			const transaction = transactions[index] ?? null;
			const paid = settledOccurrence ? settledOccurrence.paid : transaction !== null;
			// After the end of the month, only include due dates already paid early.
			if ((!paid && this.isBeforeStart(item, dueDate)) || (!paid && dueDate > monthEnd)) return [];
			const upcoming = dueDate > today && !paid;
			return [{ month: dueDate.slice(0, 7), dueDate, paid, amount: transaction ? Math.abs(transaction.amount) : null, paidDate: transaction?.date ?? null, upcoming, transaction }];
		});
	}

	/**
	 * The payment window opens a little before the due date. Within its cycle, it closes where the next due date's window
	 * opens, which always applies to cards. Otherwise a bill's window stays open no matter how late it's paid.
	 */
	private findMatch(item: RecurringItem, dueDate: string, candidates: Transaction[], usedTransactionIds: Set<string>, window: PaymentSearch): Transaction | null {
		const latestDate = window.latestDate ?? this.calendar.today();
		const followingDueDate = this.recurrence.nextDue(item.recurrence, dueDate);
		const opensDate = this.opensDate(item, dueDate);
		const closesWithCycle = window.withinCycle || this.kinds.of(item).paymentWindow === 'nearDueDate';
		// Closes the day before the next due date's window opens, so there's no gap between windows.
		const closesDate = closesWithCycle && followingDueDate ? this.calendar.addDays(this.opensDate(item, followingDueDate), -1) : null;
		const isInWindow = (transactionDate: string) => transactionDate >= opensDate && transactionDate <= latestDate && (closesDate === null || transactionDate <= closesDate);

		let closestTransaction: Transaction | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;
		for (const transaction of candidates) {
			if (usedTransactionIds.has(transaction.id) || !isInWindow(transaction.date)) continue;

			const distance = Math.abs(this.calendar.daysBetween(dueDate, transaction.date));
			if (distance < closestDistance) {
				closestTransaction = transaction;
				closestDistance = distance;
			}
		}

		if (closestTransaction) usedTransactionIds.add(closestTransaction.id);
		return closestTransaction;
	}

	/**
	 * Up to ten days early, but no further back than halfway to the previous due date, so each due date gets the days
	 * closest to it, even when a schedule's dates are uneven.
	 */
	private opensDate(item: RecurringItem, dueDate: string): string {
		const previousDueDate = this.recurrence.previousDue(item.recurrence, dueDate);
		const gapDays = previousDueDate ? this.calendar.daysBetween(previousDueDate, dueDate) : Number.POSITIVE_INFINITY;
		// A Monarch card's payment is for the statement that closed before it, which can be four weeks before the due date.
		// The window opens after the latest typical close date, and a late payment for the previous statement is settled with this one.
		const earlyDays = this.kinds.isLinked(item) ? Math.min(PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE - 1, gapDays - 1) : Math.min(EARLY_PAYMENT_DAYS, Math.floor(gapDays / 2));
		return this.calendar.addDays(dueDate, -earlyDays);
	}

	private occurrence(item: RecurringItem, dueDate: string, matchedTransaction: Transaction | null, amount: number, carried: boolean, owesNothing = false): Occurrence {
		const paid = matchedTransaction !== null || owesNothing;
		// Income that didn't arrive isn't owed, so it's never overdue.
		const isOwed = this.kinds.of(item).moneyFlow === 'outflow';
		return { item, dueDate, key: this.occurrenceKey(item.id, dueDate), amount, paid, matchedTransaction, carried, overdue: isOwed && !paid && dueDate < this.calendar.today() };
	}
}
