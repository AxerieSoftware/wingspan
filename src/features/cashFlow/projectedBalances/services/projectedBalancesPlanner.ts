import type { Calendar } from '../../../../common/calendar';
import { CENT_TOLERANCE, DAYS_PER_YEAR, floorToCents, MONTHS_PER_YEAR, roundToCents } from '../../../../common/money';
import type { ProjectedDay, Projection, ProjectionInput, ProjectionWindow, ScheduledFlow, SpendingPace } from '../models/projection';
import { PAYDAY_SEARCH_DAYS, PROJECTED_DAYS } from '../models/projectionHorizon';
import type { BalanceProjector, ReserveAccount } from './balanceProjector';
import type { CardForecaster, CardSchedule } from './cardForecaster';
import type { CardPaymentPlanner } from './cardPaymentPlanner';
import type { ScheduledFlowBuilder } from './scheduledFlowBuilder';
import type { SpendingPaceCalculator } from './spendingPaceCalculator';

/**
 * Runs the same days twice: a cash-only run, with nothing borrowed or moved in, gives free cash, and a burndown run
 * covers checking in the household's order once it runs low, showing when a card or checking would run out.
 */
export class ProjectedBalancesPlanner {
	public constructor(
		private readonly calendar: Calendar,
		private readonly paceCalculator: SpendingPaceCalculator,
		private readonly flowBuilder: ScheduledFlowBuilder,
		private readonly cardForecaster: CardForecaster,
		private readonly cardPaymentPlanner: CardPaymentPlanner,
		private readonly balanceProjector: BalanceProjector
	) {}

	/** Projects a year from today: free cash from the cash-only run, plus the burndown. */
	public plan(input: ProjectionInput): Projection {
		const today = this.calendar.today();
		const endDate = this.calendar.addDays(today, PROJECTED_DAYS);
		const checkingAccountIds = new Set(input.checkingAccountIds);
		const cardAccountIds = new Set(input.cardAccountIds);
		// Pending money out counts right away, money in only once it posts. Banks differ on whether pending is in the
		// balance, and this way an account that already includes it reads a little low until it posts, never high.
		const pendingOut = input.transactions
			.filter(transaction => transaction.pending && transaction.amount < 0 && checkingAccountIds.has(transaction.accountId ?? ''))
			.reduce((total, transaction) => total - transaction.amount, 0);
		const checkingBalance = input.accounts.filter(account => checkingAccountIds.has(account.id)).reduce((total, account) => total + (account.currentBalance ?? 0), 0) - pendingOut;

		const pace = this.paceCalculator.pace(input.transactions, new Set([...checkingAccountIds, ...cardAccountIds]), input.itemTransactionIds, input.recurringFlows, input.unassignedAccountIds);
		const flows = this.flowBuilder.flows(input.recurringFlows, input.outstandingOccurrences, input.recurringItems, { checkingAccountIds, cardAccountIds }, input.dueDayByRecurrenceId, endDate);
		const reversibleEnd = this.reversibleEnd(flows, input.safetyDays);

		const monthlySpendingByAccountId = this.monthlySpendingByProjectedAccount(pace, checkingAccountIds);
		const projectorInput = {
			checkingBalance,
			flows,
			cards: this.cardForecaster.toSchedules({ ...input, endDate }),
			monthlySpendingByAccountId,
			startDate: today,
			endDate,
			cardOrder: input.cardAccountIds
		};
		const { payments: paymentPlan, spare: cardPaymentSpare } = this.cardPaymentPlanner.plan(projectorInput, input.cushion, reversibleEnd);
		const { days, cards } = this.balanceProjector.project({ ...projectorInput, paymentPlan });
		const burndown = this.balanceProjector.project({
			...projectorInput,
			paymentPlan,
			burndown: { cushion: input.cushion, reserves: this.reserves(input) }
		});

		const reversible = this.lowestOf(
			days.filter(day => day.date <= reversibleEnd),
			reversibleEnd,
			input.cushion
		);
		// Spending free cash must not reduce a payment in full, or a minimum payment, for any card due in the window.
		const freeCash = floorToCents(Math.max(0, Math.min(reversible.lowestChecking - input.cushion, cardPaymentSpare)));

		return {
			checkingBalance,
			cushion: input.cushion,
			pace,
			cards,
			days,
			reversible,
			freeCash,
			monthlySurplus: this.monthlySurplus(flows, monthlySpendingByAccountId),
			shortfall: reversible.firstShortDate ? roundToCents(input.cushion - reversible.lowestChecking) : 0,
			creditLimit: this.creditLimit(projectorInput.cards),
			burndown: { days: burndown.days, events: burndown.events }
		};
	}

	/** Average monthly income minus bills and everyday spending over the next year. Card payments only move money between checking and cards, and interest isn't counted. */
	private monthlySurplus(flows: ScheduledFlow[], monthlySpending: ReadonlyMap<string | undefined, number>): number {
		const today = this.calendar.today();
		const yearAhead = this.calendar.addDays(today, PROJECTED_DAYS);
		// Starts tomorrow, so overdue bills carried to today from earlier months aren't counted.
		const scheduled = flows.filter(flow => (flow.kind === 'income' || flow.kind === 'bill') && flow.date > today && flow.date <= yearAhead).reduce((total, flow) => total + flow.amount, 0);
		const scheduledPerMonth = (scheduled * DAYS_PER_YEAR) / MONTHS_PER_YEAR / PROJECTED_DAYS;
		const everyday = [...monthlySpending.values()].reduce((total, monthly) => total + monthly, 0);
		return roundToCents(scheduledPerMonth - everyday);
	}

	/** Uses the same cards the projection can borrow on: Monarch cards with a known limit. */
	private creditLimit(cards: CardSchedule[]): number | null {
		const limits = cards.flatMap(card => (card.accountId && card.limit !== null ? [card.limit] : []));
		return limits.length ? limits.reduce((total, limit) => total + limit, 0) : null;
	}

	/** The later of the household's safety days and the next payday into checking. */
	private reversibleEnd(flows: ScheduledFlow[], safetyDays: number): string {
		const today = this.calendar.today();
		const paydaySearchEnd = this.calendar.addDays(today, PAYDAY_SEARCH_DAYS);
		const nextPayday = flows
			.filter(flow => flow.kind === 'income' && flow.accountId === undefined && flow.date > today && flow.date <= paydaySearchEnd)
			.reduce<string | null>((soonest, flow) => (soonest === null || flow.date < soonest ? flow.date : soonest), null);
		const safeThrough = this.calendar.addDays(today, Math.min(safetyDays, PAYDAY_SEARCH_DAYS));
		return nextPayday && nextPayday > safeThrough ? nextPayday : safeThrough;
	}

	/** Checking accounts are pooled under undefined, since the projector treats checking as one balance. */
	private monthlySpendingByProjectedAccount(pace: SpendingPace, checkingAccountIds: ReadonlySet<string>): Map<string | undefined, number> {
		const monthlySpending = new Map<string | undefined, number>([[undefined, 0]]);
		for (const [accountId, monthly] of pace.monthlyByAccountId) {
			const projectedAccountId = checkingAccountIds.has(accountId) ? undefined : accountId;
			monthlySpending.set(projectedAccountId, (monthlySpending.get(projectedAccountId) ?? 0) + monthly);
		}
		return monthlySpending;
	}

	private reserves(input: ProjectionInput): ReserveAccount[] {
		const accountsById = new Map(input.accounts.map(account => [account.id, account]));
		return input.reserveAccountIds.flatMap(accountId => {
			const account = accountsById.get(accountId);
			return account ? [{ id: account.id, name: account.displayName, balance: Math.max(0, account.currentBalance ?? 0) }] : [];
		});
	}

	/** Only counts as below the cushion by more than half a cent, so rounding never shows up as a shortfall. */
	private lowestOf(days: ProjectedDay[], endDate: string, cushion: number): ProjectionWindow {
		let lowest = { lowestChecking: Number.POSITIVE_INFINITY, lowestDate: this.calendar.today() };
		for (const day of days) {
			if (day.lowestChecking < lowest.lowestChecking) lowest = { lowestChecking: day.lowestChecking, lowestDate: day.date };
		}
		const firstShortDate = days.find(day => day.lowestChecking < cushion - CENT_TOLERANCE)?.date ?? null;
		return { endDate, ...lowest, firstShortDate };
	}
}
