import type { Calendar } from '../../../../common/calendar';
import { MONTHS_PER_YEAR, PERCENT } from '../../../../common/money';
import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import type { Account } from '../../../../monarch/api/models/account';
import { MonarchOccurrenceStatus, MonarchRecurringType } from '../../../../monarch/api/models/monarchValues';
import { occurrenceAccountId, type RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { Occurrence } from '../../../recurring/recurringItems/models/occurrence';
import type { RecurringItem } from '../../../recurring/recurringItems/models/recurringItem';
import type { RecurrenceCalculator } from '../../../recurring/recurringItems/services/recurrenceCalculator';
import type { CardPaymentKind } from '../../../recurring/statements/cardPaymentKind';
import { aprOf, creditLimitOf, isInterestCharge, minimumPaymentOf } from '../models/cardTerms';
import { OVERDUE_CARRY_MONTHS, UNKNOWN_DUE_DAYS } from '../models/projectionHorizon';

const INTEREST_LOOKBACK_DAYS = 62;
/** About the highest APR card issuers charge. */
const MAX_IMPLIED_APR = 36;
const PAYMENT_LOOKBACK_DAYS = 45;

/** A posted card transaction. amount is always positive, whichever direction the money moved. */
export interface PostedAmount {
	date: string;
	amount: number;
	/** For money in: whether the description says it's a payment, not just the transfer category. */
	isDescribedAsPayment?: boolean;
}

/** The payment matched to a statement, amount positive. */
export interface MatchedPayment {
	date: string;
	amount: number;
}

/** A counted card in the shape the projector needs: what it owes, when it's due, and its recent statement activity. */
export interface CardSchedule {
	itemId?: string;
	name: string;
	/** Set for a Monarch card, which accrues spending and owes its balance. A card outside Monarch has none and owes a fixed amount each due date. */
	accountId?: string;
	owedToday: number;
	hasAmount: boolean;
	dueDates: string[];
	/** For a card outside Monarch: the amount due on each due date after the statements already owed today. */
	typicalPayment: number;
	/** For a card outside Monarch: whether owedToday is the unpaid statement for the first due date. If not, the first due date also adds the typical payment. */
	isFirstDueDateOwedToday: boolean;
	/** When the first due date is an overdue statement moved to today, the date it was actually due. Its statement closed before that date. */
	firstStatementDueDate?: string;
	/**
	 * A Monarch card's due dates that have a matched payment, with that payment's amount. Their statements probably
	 * closed a little earlier than usual. A settled due date with no payment, such as one where nothing was owed, has 0.
	 */
	matchedPaymentByDueDate?: Readonly<Record<string, MatchedPayment>>;
	/** A Monarch card's recently posted purchases. Charges since a statement closed aren't part of that statement. */
	postedCharges?: readonly PostedAmount[];
	/** A Monarch card's payments posted recently: what's been paid since a statement closed counts toward its minimum. */
	postedPayments?: readonly PostedAmount[];
	/** A Monarch card's other recently posted credits, like refunds. They lower the balance but aren't payments. */
	postedCredits?: readonly PostedAmount[];
	/**
	 * The total of a Monarch card's pending purchases. Banks differ on whether these are in the balance, so they're
	 * assumed not to be: they're added on top of the balance and left out of statement calculations.
	 */
	pendingCharges?: number;
	hasDueDate: boolean;
	limit: number | null;
	/** Null when Monarch doesn't know it; a card outside Monarch is paid its fixed amount. */
	minimumPayment: number | null;
	chargesInterest: boolean;
	apr: number | null;
}

/** endDate is the projection's last day: due dates run through it. */
export interface CardScheduleInput {
	accounts: Account[];
	recurringItems: RecurringItem[];
	outstandingOccurrences: Occurrence[];
	settledOccurrences?: Occurrence[];
	owedByAccountId: BalancesByAccountId;
	transactions: Transaction[];
	recurringFlows: RecurringFlow[];
	/** A card payment item for a card outside Monarch always counts. */
	cardAccountIds: string[];
	endDate: string;
}

/** The household's cards with their due dates: Wingspan's card payment items, and Monarch's other counted cards. */
export class CardForecaster {
	public constructor(
		private readonly calendar: Calendar,
		private readonly recurrence: RecurrenceCalculator,
		private readonly cardPayments: CardPaymentKind
	) {}

	/** One schedule per active card payment item, skipping uncounted cards and a second item on the same card, then one per counted Monarch card no item tracks. */
	public schedules({
		accounts,
		recurringItems,
		outstandingOccurrences,
		settledOccurrences = [],
		owedByAccountId,
		transactions,
		recurringFlows,
		cardAccountIds,
		endDate
	}: CardScheduleInput): CardSchedule[] {
		const countedAccountIds = new Set(cardAccountIds);
		const accountsById = new Map(accounts.map(account => [account.id, account]));
		const lastInterestByAccountId = this.lastInterestByAccountId(transactions);
		// One schedule per Monarch card, so if two items track the same card, its balance is only counted once.
		const trackedAccountIds = new Set<string>();
		const cardItems = recurringItems.filter(item => {
			const accountId = this.cardPayments.linkedAccountId(item);
			if (!this.cardPayments.owns(item) || !item.active || (accountId && !countedAccountIds.has(accountId))) return false;
			if (!accountId) return true;
			if (trackedAccountIds.has(accountId)) return false;
			trackedAccountIds.add(accountId);
			return true;
		});
		const linkedAccountIds = new Set(cardItems.map(item => this.cardPayments.linkedAccountId(item)).filter(accountId => accountId !== undefined));

		const itemSchedules = cardItems.map((item): CardSchedule => {
			const accountId = this.cardPayments.linkedAccountId(item);
			const occurrences = outstandingOccurrences.filter(outstanding => outstanding.item.id === item.id);
			// A Monarch card's statement carried over from last month and partly paid is no longer outstanding, but may still have a balance.
			const trackedOccurrences = [...new Map([...settledOccurrences, ...occurrences].filter(each => each.item.id === item.id).map(each => [each.key, each])).values()];
			const unpaidOccurrences = occurrences.filter(occurrence => !occurrence.paid);
			// Owed today: the statements already due, or if there are none, the next one. Later ones this month keep their own dates.
			const today = this.calendar.today();
			const dueByToday = unpaidOccurrences.filter(occurrence => occurrence.dueDate <= today);
			const owedNow = dueByToday.length ? dueByToday : unpaidOccurrences.slice(0, 1);
			return {
				itemId: item.id,
				name: item.name,
				accountId,
				owedToday: this.cardPayments.owedOnCard(item, owedByAccountId) ?? owedNow.reduce((total, occurrence) => total + occurrence.amount, 0),
				hasAmount: !this.cardPayments.isAmountUnknown(item, owedByAccountId),
				isFirstDueDateOwedToday: owedNow.length > 0,
				...(accountId
					? {
							...this.linkedDueDates(item, trackedOccurrences, endDate),
							matchedPaymentByDueDate: Object.fromEntries(
								trackedOccurrences
									.filter(occurrence => occurrence.paid)
									.map(occurrence => [occurrence.dueDate, { date: occurrence.matchedTransaction?.date ?? occurrence.dueDate, amount: Math.abs(occurrence.matchedTransaction?.amount ?? 0) }])
							),
							postedCharges: this.postedCharges(accountId, transactions),
							postedPayments: this.postedPayments(accountId, transactions),
							postedCredits: this.postedCredits(accountId, transactions),
							pendingCharges: this.pendingCharges(accountId, transactions)
						}
					: {
							firstStatementDueDate: owedNow.at(-1)?.dueDate,
							dueDates: this.itemDueDates(
								item,
								occurrences,
								endDate,
								owedNow.map(occurrence => occurrence.dueDate)
							)
						}),
				typicalPayment: item.amount,
				hasDueDate: true,
				...this.termsOf(accountId ? accountsById.get(accountId) : undefined, lastInterestByAccountId, owedByAccountId)
			};
		});

		const unlinkedSchedules = accounts
			.filter(account => countedAccountIds.has(account.id) && !linkedAccountIds.has(account.id))
			.map(
				(account): CardSchedule => ({
					name: account.displayName,
					accountId: account.id,
					owedToday: owedByAccountId[account.id] ?? 0,
					hasAmount: owedByAccountId[account.id] !== undefined,
					isFirstDueDateOwedToday: true,
					...this.unlinkedDueDates(account.id, recurringFlows, transactions, endDate),
					postedCharges: this.postedCharges(account.id, transactions),
					postedPayments: this.postedPayments(account.id, transactions),
					postedCredits: this.postedCredits(account.id, transactions),
					pendingCharges: this.pendingCharges(account.id, transactions),
					typicalPayment: 0,
					...this.termsOf(account, lastInterestByAccountId, owedByAccountId)
				})
			);

		return [...itemSchedules, ...unlinkedSchedules];
	}

	/**
	 * An unpaid occurrence is due today at the latest; a paid one, even if paid early, moves the card to its next due date.
	 * For a card without a Monarch account, occurrences already counted in owedToday aren't scheduled again on their own dates.
	 */
	private itemDueDates(item: RecurringItem, occurrences: Occurrence[], endDate: string, countedDueDates: string[]): string[] {
		const today = this.calendar.today();
		const unpaidOccurrence = occurrences.find(occurrence => !occurrence.paid);
		const paidDueDates = occurrences.filter(occurrence => occurrence.paid).map(occurrence => occurrence.dueDate);
		const lastPaidDueDate = paidDueDates.reduce((latest, dueDate) => (dueDate > latest ? dueDate : latest), '');
		const searchFrom = lastPaidDueDate >= today ? this.calendar.addDays(lastPaidDueDate, 1) : today;
		const firstDueDate = unpaidOccurrence ? (unpaidOccurrence.dueDate < today ? today : unpaidOccurrence.dueDate) : this.recurrence.upcomingDue(item.recurrence, searchFrom);
		if (!firstDueDate || firstDueDate > endDate) return [];
		const counted = new Set([...countedDueDates, ...paidDueDates]);
		const laterDueDates = this.recurrence.dueDates(item.recurrence, this.calendar.addDays(firstDueDate, 1), endDate).filter(dueDate => !counted.has(dueDate));
		return [firstDueDate, ...laterDueDates];
	}

	/**
	 * A Monarch card's statements are calculated from its balance, which already reflects every payment (including
	 * partial ones), so matched payments don't remove due dates from its schedule. The latest statement already due that
	 * the ledger tracks, whether unpaid or partly paid, may still have a balance, which is due today; the projector
	 * calculates how much, if any.
	 */
	private linkedDueDates(item: RecurringItem, occurrences: Occurrence[], endDate: string): Pick<CardSchedule, 'dueDates' | 'firstStatementDueDate'> {
		const today = this.calendar.today();
		const upcoming = this.recurrence.dueDates(item.recurrence, this.calendar.addDays(today, 1), endDate);
		const latestDue = occurrences.filter(occurrence => occurrence.dueDate <= today).reduce((latest, occurrence) => (occurrence.dueDate > latest ? occurrence.dueDate : latest), '');
		if (!latestDue) return { dueDates: upcoming };
		return { dueDates: [today, ...upcoming], firstStatementDueDate: latestDue };
	}

	/**
	 * A card without a card payment item: due when Monarch's recurring statement for it says, or on the day of the
	 * month it was last paid. With neither, it's assumed due in 30 days, and flagged so the household can add one.
	 */
	private unlinkedDueDates(accountId: string, recurringFlows: RecurringFlow[], transactions: Transaction[], endDate: string): Pick<CardSchedule, 'dueDates' | 'hasDueDate' | 'firstStatementDueDate'> {
		const today = this.calendar.today();
		const monthStart = `${this.calendar.currentMonth()}-01`;
		const carryStart = `${this.calendar.addMonths(this.calendar.currentMonth(), -OVERDUE_CARRY_MONTHS)}-01`;
		const statementDates = recurringFlows
			.filter(flow => flow.recurrenceGroup.recurringType === MonarchRecurringType.creditCard)
			.flatMap(flow =>
				flow.occurrences.filter(
					occurrence =>
						occurrenceAccountId(flow, occurrence) === accountId &&
						occurrence.status !== MonarchOccurrenceStatus.paid &&
						(occurrence.date >= monthStart || (occurrence.status === MonarchOccurrenceStatus.overdue && occurrence.date >= carryStart))
				)
			)
			.map(occurrence => occurrence.date);
		// An overdue statement is due today, but its statement still closed before its real due date.
		const overdueDates = statementDates.filter(dueDate => dueDate < today).sort();
		const dueDates = statementDates.map(dueDate => (dueDate < today ? today : dueDate)).filter(dueDate => dueDate <= endDate);
		if (dueDates.length) return { dueDates: [...new Set(dueDates)].sort(), hasDueDate: true, firstStatementDueDate: overdueDates.at(-1) };

		const sinceDate = this.calendar.addDays(today, -PAYMENT_LOOKBACK_DAYS);
		const lastPayment = transactions
			.filter(transaction => transaction.date >= sinceDate && this.cardPayments.isPaymentToCard(transaction, accountId))
			.reduce<Transaction | null>((latest, transaction) => (!latest || transaction.date > latest.date ? transaction : latest), null);
		if (lastPayment) return { dueDates: this.monthlyFrom(this.calendar.addDays(today, 1), this.calendar.dayOf(lastPayment.date), endDate), hasDueDate: true };

		return { dueDates: this.monthlyFrom(this.calendar.addDays(today, UNKNOWN_DUE_DAYS), this.calendar.dayOf(this.calendar.addDays(today, UNKNOWN_DUE_DAYS)), endDate), hasDueDate: false };
	}

	private monthlyFrom(fromDate: string, day: number, endDate: string): string[] {
		const dueDates: string[] = [];
		for (let months = 0; ; months++) {
			const dueDate = this.calendar.dayInMonth(this.calendar.addMonths(this.calendar.monthOf(fromDate), months), day);
			if (dueDate > endDate) return dueDates;
			if (dueDate >= fromDate) dueDates.push(dueDate);
		}
	}

	/** Without an APR in Monarch, a card charging interest gets the yearly rate its last interest charge implies. */
	private termsOf(
		account: Account | undefined,
		lastInterestByAccountId: ReadonlyMap<string, number>,
		owedByAccountId: BalancesByAccountId
	): Pick<CardSchedule, 'chargesInterest' | 'apr' | 'limit' | 'minimumPayment'> {
		const lastInterest = account ? lastInterestByAccountId.get(account.id) : undefined;
		const owed = account ? (owedByAccountId[account.id] ?? 0) : 0;
		// Interest charged on an older, higher balance would imply an unrealistic rate on a paid-down card, so it's capped.
		const impliedApr = lastInterest !== undefined && owed > 0 ? Math.min(MAX_IMPLIED_APR, (lastInterest / owed) * MONTHS_PER_YEAR * PERCENT) : null;
		return {
			chargesInterest: lastInterest !== undefined,
			apr: (account ? aprOf(account) : null) ?? impliedApr,
			limit: account ? creditLimitOf(account) : null,
			minimumPayment: account ? minimumPaymentOf(account) : null
		};
	}

	/** Payments that weren't returned. A returned payment and its return are both left out, since together they neither pay nor charge anything. */
	private postedPayments(accountId: string, transactions: Transaction[]): PostedAmount[] {
		const { paymentIds } = this.cardPayments.returnedPayments(accountId, transactions);
		return transactions
			.filter(transaction => !transaction.pending)
			.filter(transaction => this.cardPayments.isPaymentToCard(transaction, accountId) && !paymentIds.has(transaction.id))
			.map(transaction => ({ date: transaction.date, amount: transaction.amount, isDescribedAsPayment: this.cardPayments.isDescribedAsPayment(transaction) }));
	}

	private postedCredits(accountId: string, transactions: Transaction[]): PostedAmount[] {
		return transactions
			.filter(transaction => !transaction.pending && transaction.accountId === accountId && transaction.amount > 0 && !this.cardPayments.isPaymentToCard(transaction, accountId))
			.map(transaction => ({ date: transaction.date, amount: transaction.amount }));
	}

	private postedCharges(accountId: string, transactions: Transaction[]): PostedAmount[] {
		const { returnIds } = this.cardPayments.returnedPayments(accountId, transactions);
		return transactions
			.filter(transaction => !transaction.pending && transaction.accountId === accountId && transaction.amount < 0 && !returnIds.has(transaction.id))
			.map(transaction => ({ date: transaction.date, amount: -transaction.amount }));
	}

	private pendingCharges(accountId: string, transactions: Transaction[]): number {
		return transactions.filter(transaction => transaction.pending && transaction.accountId === accountId && transaction.amount < 0).reduce((total, transaction) => total - transaction.amount, 0);
	}

	/** Each card's most recent interest charge, as a positive amount. */
	private lastInterestByAccountId(transactions: Transaction[]): ReadonlyMap<string, number> {
		const sinceDate = this.calendar.addDays(this.calendar.today(), -INTEREST_LOOKBACK_DAYS);
		const latest = new Map<string, Transaction>();
		for (const transaction of transactions) {
			if (!transaction.accountId || transaction.date < sinceDate || !isInterestCharge(transaction)) continue;
			const current = latest.get(transaction.accountId);
			if (!current || transaction.date > current.date) latest.set(transaction.accountId, transaction);
		}
		return new Map([...latest].map(([accountId, transaction]) => [accountId, Math.abs(transaction.amount)]));
	}
}
