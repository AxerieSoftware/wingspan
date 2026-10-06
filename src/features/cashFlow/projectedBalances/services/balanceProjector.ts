import type { Calendar } from '../../../../common/calendar';
import { CENT_TOLERANCE, DAYS_PER_YEAR, MONTHS_PER_YEAR, PERCENT } from '../../../../common/money';
import { PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE, STATEMENT_CLOSE_DAYS_BEFORE_DUE } from '../../../recurring/statements/models/statementCycle';
import type { CardForecast, ProjectedDay, ProjectionEvent, ScheduledFlow } from '../models/projection';
import type { CardSchedule, MatchedPayment, PostedAmount } from './cardForecaster';
import type { MinimumPaymentEstimator } from './minimumPaymentEstimator';

const NO_SPENDING: ReadonlyMap<string | undefined, number> = new Map();
const SPENDING_LABEL = 'Everyday spending';

/** A cash account drawn from once the cards can't cover checking. balance is today's balance, floored at $0. */
export interface ReserveAccount {
	id: string;
	name: string;
	balance: number;
}

/** Keeps checking at the cushion by borrowing on the cards, then drawing from reserves in order. */
export interface BurndownRules {
	cushion: number;
	reserves: ReserveAccount[];
}

/** startDate and endDate are both included. */
export interface ProjectorInput {
	checkingBalance: number;
	flows: ScheduledFlow[];
	cards: CardSchedule[];
	/** Checking's spending is keyed by undefined; each card's by its account id. */
	monthlySpendingByAccountId: ReadonlyMap<string | undefined, number>;
	startDate: string;
	endDate: string;
	/** Card account ids in the order they're borrowed on and take charges that go past another card's limit. */
	cardOrder: string[];
	/** What checking pays each card on each due date, by cardPaymentKey. A due date missing from it gets no payment. */
	paymentPlan: ReadonlyMap<string, number>;
	/** Without rules, nothing covers checking when it runs low. */
	burndown?: BurndownRules;
}

/** The days, each card with its payments, and the events in date order. */
export interface ProjectorResult {
	days: ProjectedDay[];
	cards: CardForecast[];
	events: ProjectionEvent[];
}

/** The payment plan key for a due date: the card's index in the schedules plus the date. */
export const cardPaymentKey = (cardIndex: number, date: string) => `${cardIndex}|${date}`;

interface CardState {
	index: number;
	schedule: CardSchedule;
	owed: number;
	dueDates: ReadonlySet<string>;
	forecast: CardForecast;
	isMaxedOut: boolean;
	hasPassedDueDate: boolean;
	owedByDate: Map<string, number>;
	/** The due date of the most recently closed statement as of today. Monarch's minimum payment is for that statement. */
	monarchMinimumDueDate: string | undefined;
	/** Carrying a balance from a statement that wasn't paid in full, so the balance accrues interest. */
	isRevolving: boolean;
	dailySpending: number;
}

interface DayState {
	date: string;
	checking: number;
	flows: ScheduledFlow[];
	events: ProjectionEvent[];
}

/**
 * Projects checking day by day from today. Everyday spending comes out of checking daily, or adds to the card it's
 * charged to. On each due date, checking pays the card the amount in the payment plan, and the rest stays on the card.
 * A card carrying a balance accrues daily interest at its APR until a statement is paid in full. Charges past a card's
 * limit move to the next counted card with room; if no card has room, they stay over the limit. They never go to
 * checking.
 */
export class BalanceProjector {
	public constructor(
		private readonly calendar: Calendar,
		private readonly minimumEstimator: MinimumPaymentEstimator
	) {}

	/** Runs each day from startDate through endDate, both included. */
	public project(input: ProjectorInput): ProjectorResult {
		const flowsByDate = Map.groupBy(input.flows, flow => flow.date);
		const cards = input.cards.map(
			(schedule, index): CardState => ({
				index,
				schedule,
				// Pending purchases are owed on top of the balance; statements are still worked out from the balance alone.
				owed: schedule.owedToday + (schedule.pendingCharges ?? 0),
				dueDates: new Set(schedule.dueDates),
				isMaxedOut: false,
				hasPassedDueDate: false,
				monarchMinimumDueDate: this.latestClosedDueDate(schedule, input.startDate),
				owedByDate: new Map(),
				isRevolving: schedule.chargesInterest,
				dailySpending: schedule.accountId ? this.daily(input.monthlySpendingByAccountId.get(schedule.accountId)) : 0,
				forecast: {
					itemId: schedule.itemId,
					name: schedule.name,
					owedToday: schedule.owedToday,
					payments: [],
					hasDueDate: schedule.hasDueDate,
					hasAmount: schedule.hasAmount,
					chargesInterest: schedule.chargesInterest,
					apr: schedule.apr
				}
			})
		);
		const lenders = this.lenders(cards, input.cardOrder);
		const reserves = (input.burndown?.reserves ?? []).map(reserve => ({ ...reserve }));
		const checkingDailySpending = this.daily(input.monthlySpendingByAccountId.get(undefined));
		const days: ProjectedDay[] = [];
		const events: ProjectionEvent[] = [];
		let checking = input.checkingBalance;
		let hasUsedCushion = false;
		const startingReserves = reserves.reduce((total, reserve) => total + reserve.balance, 0);
		let isOutOfCash = false;

		for (const date of this.calendar.datesBetween(input.startDate, input.endDate)) {
			const day: DayState = { date, checking, flows: [...(flowsByDate.get(date) ?? [])], events: [] };
			// Today's spending so far is already in the balances; the pace starts tomorrow.
			const isToday = date === input.startDate;
			if (checkingDailySpending && !isToday) day.flows.push({ date, amount: -checkingDailySpending, label: SPENDING_LABEL, kind: 'spending' });

			for (const card of cards) {
				const payment = this.advanceCard(card, day, isToday ? NO_SPENDING : input.monthlySpendingByAccountId, input.paymentPlan, lenders, input.startDate);
				if (payment) day.flows.push({ date, amount: -payment, label: card.schedule.name, kind: 'cardPayment' });
			}

			// Bills and spending go out before the day's deposits; card payments, sized to what checking can afford, go out after.
			const isCheckingFlow = (flow: ScheduledFlow) => flow.accountId === undefined;
			day.checking += this.sumOf(day.flows.filter(flow => isCheckingFlow(flow) && flow.amount < 0 && flow.kind !== 'cardPayment'));
			if (input.burndown) {
				const usedCushion = this.burnDown(day, input.burndown, lenders, reserves);
				if (usedCushion && !hasUsedCushion) day.events.push({ date, kind: 'cushionUsed', label: 'Drops below the amount you keep' });
				hasUsedCushion ||= usedCushion;
			}
			// Recorded at the end of the day, so anything borrowed on a statement's closing day is on that statement, like that day's spending.
			for (const card of cards) card.owedByDate.set(date, card.owed);
			const beforeDeposits = day.checking;
			// Draws were added to checking as they were made.
			day.checking += this.sumOf(day.flows.filter(flow => isCheckingFlow(flow) && flow.amount > 0 && flow.kind !== 'draw'));
			day.checking += this.sumOf(day.flows.filter(flow => isCheckingFlow(flow) && flow.kind === 'cardPayment'));
			const lowestChecking = Math.min(beforeDeposits, day.checking);
			if (lowestChecking < -CENT_TOLERANCE && !isOutOfCash) {
				isOutOfCash = true;
				day.events.push({ date, kind: 'outOfCash', label: 'Checking runs out' });
			}
			checking = day.checking;

			events.push(...day.events);
			// A card's credit balance offsets what the other cards owe, so borrowing against it doesn't count as money gained.
			const cardsOwed = cards.reduce((total, card) => total + card.owed, 0);
			const cardsPaid = -this.sumOf(day.flows.filter(flow => isCheckingFlow(flow) && flow.kind === 'cardPayment'));
			const reservesDrawn = startingReserves - reserves.reduce((total, reserve) => total + reserve.balance, 0);
			days.push({
				date,
				lowestChecking,
				checking,
				cardsOwed,
				reservesDrawn,
				lowestAfterCards: Math.min(beforeDeposits - (cardsOwed + cardsPaid), day.checking - cardsOwed) - reservesDrawn,
				creditLeft: lenders.length ? lenders.reduce((total, card) => total + this.available(card), 0) : null,
				creditUsed: lenders.reduce((total, card) => total + Math.max(0, card.owed), 0),
				flows: day.flows
			});
		}

		return { days, cards: cards.map(card => card.forecast), events };
	}

	/**
	 * Adds the day's charges and interest, then makes the planned payment if one is due. On a Monarch card's due date the
	 * statement balance is due; charges after the statement closed go on the next statement. Paying the statement in
	 * full stops interest. A card outside Monarch owes its typical amount each due date, plus anything left unpaid.
	 */
	private advanceCard(
		card: CardState,
		day: DayState,
		monthlySpendingByAccountId: ReadonlyMap<string | undefined, number>,
		paymentPlan: ReadonlyMap<string, number>,
		lenders: CardState[],
		startDate: string
	): number {
		const { accountId, limit } = card.schedule;
		if (accountId) {
			const charges = this.daily(monthlySpendingByAccountId.get(accountId)) - this.sumOf(day.flows.filter(flow => flow.accountId === accountId));
			card.owed += charges;
			// Today's balances are as Monarch has them; interest, like spending, starts tomorrow.
			const accruesInterest = card.isRevolving && card.schedule.apr !== null && card.owed > 0 && day.date !== startDate;
			if (accruesInterest) card.owed += (card.owed * (card.schedule.apr ?? 0)) / PERCENT / DAYS_PER_YEAR;
			if (limit !== null && card.owed > limit + CENT_TOLERANCE) {
				this.markMaxedOut(card, day);
				this.moveOverLimitCharges(card, Math.min(card.owed - limit, Math.max(0, charges)), day, lenders);
			}
		}
		if (!card.dueDates.has(day.date)) return 0;

		const isFirstDueDate = !card.hasPassedDueDate;
		if (!accountId && (!isFirstDueDate || !card.schedule.isFirstDueDateOwedToday)) card.owed += card.schedule.typicalPayment;
		card.hasPassedDueDate = true;
		const statementDueDate = isFirstDueDate ? (card.schedule.firstStatementDueDate ?? day.date) : day.date;
		const due = accountId ? Math.min(this.statementBalance(card, statementDueDate, startDate), Math.max(0, card.owed)) : Math.max(0, card.owed);
		if (due <= CENT_TOLERANCE) {
			card.isRevolving = false;
			return 0;
		}

		const payment = Math.min(due, paymentPlan.get(cardPaymentKey(card.index, day.date)) ?? 0);
		// Monarch's minimum only applies to this statement; later minimums are estimated from their balances. Every
		// payment posted since the statement closed already counts toward its minimum.
		const paidToward = this.postedSince(card.schedule.postedPayments, this.closeDateOf(card, statementDueDate, startDate), startDate);
		const monarchMinimum = statementDueDate === card.monarchMinimumDueDate ? card.schedule.minimumPayment : null;
		const minimumIsEstimated = !!accountId && monarchMinimum === null;
		const statementMinimum = monarchMinimum ?? this.minimumEstimator.estimate(due + paidToward, card.schedule.apr);
		const minimum = !accountId ? due : Math.max(0, statementMinimum - paidToward);
		card.owed -= payment;
		card.isRevolving = payment < due - CENT_TOLERANCE;
		if (card.schedule.limit === null || card.owed <= card.schedule.limit + CENT_TOLERANCE) card.isMaxedOut = false;
		card.forecast.payments.push({ date: day.date, amount: payment, owed: due, minimum: Math.min(minimum, due), minimumIsEstimated });
		return payment;
	}

	/**
	 * What the card owed when the statement closed, minus payments since. For a statement that closed before today,
	 * that's today's balance (which already reflects every payment so far) minus what's been charged since the close.
	 */
	private statementBalance(card: CardState, dueDate: string, startDate: string): number {
		const closeDate = this.closeDateOf(card, dueDate, startDate);
		const chargedSinceClose = this.postedSince(card.schedule.postedCharges, closeDate, startDate);
		const owedAtClose = card.owedByDate.get(closeDate) ?? card.schedule.owedToday - chargedSinceClose;
		const paidSinceClose = card.forecast.payments.filter(payment => payment.date > closeDate).reduce((total, payment) => total + payment.amount, 0);
		return Math.max(0, owedAtClose - paidSinceClose);
	}

	/**
	 * Most statements close 25 days before they're due. For a statement with a matched payment, later close dates are
	 * tried first: if it was paid in full, the balance at its real close is zero apart from refunds since, so it comes
	 * out to nothing instead of a few days of spending. Otherwise, such as with a partial payment, the usual close is
	 * used so the remainder isn't understated.
	 */
	private closeDateOf(card: CardState, dueDate: string, startDate: string): string {
		const usualClose = this.calendar.addDays(dueDate, -STATEMENT_CLOSE_DAYS_BEFORE_DUE);
		const matchedPayment = card.schedule.matchedPaymentByDueDate?.[dueDate];
		if (matchedPayment === undefined) return usualClose;
		// Try each close later than the usual one, latest first. The first where the statement comes to zero is the real close.
		for (let daysBefore = PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE; daysBefore > STATEMENT_CLOSE_DAYS_BEFORE_DUE; daysBefore--) {
			const close = this.calendar.addDays(dueDate, -daysBefore);
			const leftSinceClose = card.schedule.owedToday - this.postedSince(card.schedule.postedCharges, close, startDate);
			// The balance can only go below zero from credits that didn't pay this statement: refunds, money in that only
			// Monarch's category marks as a payment, and payments after its due date, which are for the next statement.
			const refundedSinceClose = this.postedSince(card.schedule.postedCredits, close, startDate) + this.notPayingStatement(card, close, dueDate, matchedPayment, startDate);
			if (leftSinceClose <= CENT_TOLERANCE && leftSinceClose >= -refundedSinceClose - CENT_TOLERANCE) return close;
		}
		return usualClose;
	}

	private notPayingStatement(card: CardState, closeDate: string, dueDate: string, matchedPayment: MatchedPayment, startDate: string): number {
		const paidIn = (card.schedule.postedPayments ?? []).filter(entry => entry.date > closeDate && entry.date <= startDate);
		const filedOnly = paidIn.filter(entry => !entry.isDescribedAsPayment).reduce((total, entry) => total + entry.amount, 0);
		const afterDue = paidIn.filter(entry => entry.isDescribedAsPayment && entry.date > dueDate).reduce((total, entry) => total + entry.amount, 0);
		const matchedAfterDue = matchedPayment.date > dueDate ? matchedPayment.amount : 0;
		return filedOnly + Math.max(0, afterDue - matchedAfterDue);
	}

	/** The due date of the card's statement with the latest close date on or before today. */
	private latestClosedDueDate(schedule: CardSchedule, startDate: string): string | undefined {
		// When the first statement was moved to today, use its real due date instead.
		const dueDates = schedule.firstStatementDueDate ? [schedule.firstStatementDueDate, ...schedule.dueDates.slice(1)] : schedule.dueDates;
		return dueDates
			.filter(dueDate => this.calendar.addDays(dueDate, -STATEMENT_CLOSE_DAYS_BEFORE_DUE) <= startDate)
			.sort()
			.at(-1);
	}

	private postedSince(posted: readonly PostedAmount[] | undefined, closeDate: string, throughDate: string): number {
		return (posted ?? []).filter(entry => entry.date > closeDate && entry.date <= throughDate).reduce((total, entry) => total + entry.amount, 0);
	}

	/** Keeps checking at the cushion by borrowing on the cards, then drawing from reserves. Returns whether checking still dropped below the cushion. */
	private burnDown(day: DayState, rules: BurndownRules, lenders: CardState[], reserves: ReserveAccount[]): boolean {
		const gap = () => rules.cushion - day.checking;
		if (gap() > CENT_TOLERANCE) this.borrow(day, gap(), lenders);
		if (gap() > CENT_TOLERANCE) this.drawReserves(day, gap(), reserves);
		return day.checking < rules.cushion - CENT_TOLERANCE;
	}

	private borrow(day: DayState, gap: number, lenders: CardState[]): void {
		let remaining = gap;
		for (const card of lenders) {
			const amount = Math.min(remaining, this.available(card));
			if (amount <= CENT_TOLERANCE) continue;

			card.owed += amount;
			day.checking += amount;
			remaining -= amount;
			day.flows.push({ date: day.date, amount, label: `On ${card.schedule.name}`, kind: 'draw' });
			if (this.available(card) <= CENT_TOLERANCE) this.markMaxedOut(card, day);
			if (remaining <= CENT_TOLERANCE) return;
		}
	}

	private drawReserves(day: DayState, gap: number, reserves: ReserveAccount[]): void {
		let remaining = gap;
		for (const reserve of reserves) {
			const amount = Math.min(remaining, reserve.balance);
			if (amount <= CENT_TOLERANCE) continue;

			reserve.balance -= amount;
			day.checking += amount;
			remaining -= amount;
			day.flows.push({ date: day.date, amount, label: `From ${reserve.name}`, kind: 'draw' });
			if (remaining <= CENT_TOLERANCE) return;
		}
	}

	/** Monarch cards with a known limit, in borrowing order; cards missing from the order go last. */
	private lenders(cards: CardState[], cardOrder: string[]): CardState[] {
		const rank = (card: CardState) => {
			const index = cardOrder.indexOf(card.schedule.accountId ?? '');
			return index === -1 ? Number.POSITIVE_INFINITY : index;
		};
		return cards.filter(card => card.schedule.accountId && card.schedule.limit !== null).sort((a, b) => rank(a) - rank(b));
	}

	/**
	 * Moves today's charges past a card's limit to the next counted cards with room, in borrowing order, the way the
	 * household would switch to another card. Checking is never touched. Anything no card has room for stays over the limit.
	 */
	private moveOverLimitCharges(card: CardState, overLimit: number, day: DayState, lenders: CardState[]): void {
		let remaining = overLimit;
		for (const lender of lenders) {
			if (lender === card || remaining <= CENT_TOLERANCE) continue;
			const moved = Math.min(remaining, this.available(lender));
			if (moved <= CENT_TOLERANCE) continue;

			lender.owed += moved;
			card.owed -= moved;
			remaining -= moved;
			if (this.available(lender) <= CENT_TOLERANCE) this.markMaxedOut(lender, day);
		}
	}

	private markMaxedOut(card: CardState, day: DayState): void {
		if (card.isMaxedOut) return;
		day.events.push({ date: day.date, kind: 'cardMaxedOut', label: `${card.schedule.name} maxes out` });
		card.isMaxedOut = true;
	}

	/** A credit balance doesn't add to the limit. */
	private available(card: CardState): number {
		return Math.max(0, (card.schedule.limit ?? 0) - Math.max(0, card.owed));
	}

	private daily(monthly: number | undefined): number {
		return ((monthly ?? 0) * MONTHS_PER_YEAR) / DAYS_PER_YEAR;
	}

	private sumOf(flows: ScheduledFlow[]): number {
		return flows.reduce((total, flow) => total + flow.amount, 0);
	}
}
