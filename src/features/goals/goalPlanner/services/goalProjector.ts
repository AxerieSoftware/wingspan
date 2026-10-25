import type { Calendar } from '../../../../common/calendar';
import { CENTS_PER_DOLLAR, MONTHS_PER_YEAR, PERCENT, roundToCents, toCents } from '../../../../common/money';
import type { GoalOutcome, PlannedGoal } from '../models/plannedGoal';

/** A goal that takes longer than this at some amount is treated as never reached. */
export const MAX_YEARS = 50;
const MAX_MONTHS = MAX_YEARS * MONTHS_PER_YEAR;

/** What goes toward a goal each month, and the goal its money moves to once it's done, if any. */
export interface GoalFunding {
	monthly: number;
	rollsTo: string | null;
}

/** One goal as the months are run: what's saved or owed, in cents, and what goes toward it now, rolled-in money included. */
interface RunningGoal {
	goal: PlannedGoal;
	amountCents: number;
	monthlyCents: number;
	/** Interest charged on a debt, or growth earned by savings. */
	interestCents: number;
	path: number[];
	finishedAfterMonths: number | null;
}

/**
 * Where each goal ends up, run month by month together, with the first amounts going toward them next month. Savings
 * earn a month's growth at their rate on what's saved, then get what goes in. A debt is charged a month's interest on
 * what's owed, then paid. Once a goal is done, everything going toward it moves, from the next month, to the goal it
 * rolls to, or on down that goal's own rollover if it's done too. Money left over in the month a goal finishes isn't
 * moved.
 *
 * Invariants, in whole cents: in a month, a goal gets no more than its monthly amount; a savings goal never passes its
 * target, and grows by its growth plus what went in; a debt's payments add up to what it owed plus the interest charged.
 */
export class GoalProjector {
	public constructor(private readonly calendar: Calendar) {}

	/** Each goal's outcome, by id. A goal with no funding gets nothing each month. */
	public project(goals: readonly PlannedGoal[], fundingById: ReadonlyMap<string, GoalFunding>): Map<string, GoalOutcome> {
		const runningById = new Map(goals.map(goal => [goal.id, this.toRunning(goal, fundingById.get(goal.id)?.monthly ?? 0)]));
		// Goals already at their target hand on their money from the start.
		for (const running of runningById.values()) if (running.finishedAfterMonths === 0) this.rollOver(running, runningById, fundingById);

		let unfinishedCount = [...runningById.values()].filter(running => running.finishedAfterMonths === null).length;
		for (let month = 1; month <= MAX_MONTHS && unfinishedCount > 0; month++) {
			const finishedThisMonth: RunningGoal[] = [];
			for (const running of runningById.values()) {
				if (running.finishedAfterMonths !== null) continue;
				this.runMonth(running);
				if (running.amountCents === (running.goal.kind === 'saving' ? toCents(running.goal.target) : 0)) {
					running.finishedAfterMonths = month;
					finishedThisMonth.push(running);
					unfinishedCount--;
				}
			}
			for (const running of finishedThisMonth) this.rollOver(running, runningById, fundingById);
		}

		return new Map([...runningById].map(([goalId, running]) => [goalId, this.toOutcome(running)]));
	}

	/**
	 * The least a month, to the cent, that reaches a savings goal by the end of its target month on its own, or null when
	 * its target month has passed. Invariant: that amount reaches it by then, and a cent less doesn't.
	 */
	public neededMonthly(goal: PlannedGoal & { kind: 'saving' }, targetMonth: string): number | null {
		const months = this.calendar.monthsBetween(this.calendar.currentMonth(), targetMonth);
		if (months < 1) return null;
		const reachesWith = (monthlyCents: number) => {
			const outcome = this.project([goal], new Map([[goal.id, { monthly: monthlyCents / CENTS_PER_DOLLAR, rollsTo: null }]])).get(goal.id);
			return outcome?.finishMonth != null && outcome.finishMonth <= targetMonth;
		};
		// Putting all that's left in next month always reaches it, so the least amount is between none and that.
		let lowCents = 0;
		let highCents = Math.max(0, toCents(goal.target) - toCents(goal.balance));
		if (reachesWith(lowCents)) return 0;
		while (highCents - lowCents > 1) {
			const middleCents = Math.floor((lowCents + highCents) / 2);
			if (reachesWith(middleCents)) highCents = middleCents;
			else lowCents = middleCents;
		}
		return highCents / CENTS_PER_DOLLAR;
	}

	private toRunning(goal: PlannedGoal, monthly: number): RunningGoal {
		const amountCents = toCents(goal.kind === 'saving' ? goal.balance : goal.owed);
		const isReached = goal.kind === 'saving' && amountCents >= toCents(goal.target);
		return { goal, amountCents, monthlyCents: toCents(monthly), interestCents: 0, path: [amountCents / CENTS_PER_DOLLAR], finishedAfterMonths: isReached ? 0 : null };
	}

	private runMonth(running: RunningGoal): void {
		const { goal } = running;
		if (goal.kind === 'saving') {
			const grownCents = Math.min(this.monthOfInterestCents(running.amountCents, goal.growthRate), toCents(goal.target) - running.amountCents);
			running.interestCents += grownCents;
			running.amountCents += grownCents + Math.min(running.monthlyCents, toCents(goal.target) - running.amountCents - grownCents);
		} else {
			const chargedCents = this.monthOfInterestCents(running.amountCents, goal.interestRate);
			running.interestCents += chargedCents;
			running.amountCents += chargedCents - Math.min(running.monthlyCents, running.amountCents + chargedCents);
		}
		running.path.push(running.amountCents / CENTS_PER_DOLLAR);
	}

	/** A month's interest or growth at a yearly rate, as a percentage, rounded to the cent. */
	private monthOfInterestCents(amountCents: number, yearlyRate: number): number {
		return toCents(roundToCents((amountCents / CENTS_PER_DOLLAR) * (yearlyRate / PERCENT / MONTHS_PER_YEAR)));
	}

	/** Moves a finished goal's monthly money to the first goal down its rollover that isn't done, if any. */
	private rollOver(finished: RunningGoal, runningById: ReadonlyMap<string, RunningGoal>, fundingById: ReadonlyMap<string, GoalFunding>): void {
		const visitedIds = new Set([finished.goal.id]);
		let targetId = fundingById.get(finished.goal.id)?.rollsTo ?? null;
		while (targetId && !visitedIds.has(targetId)) {
			const target = runningById.get(targetId);
			if (!target) return;
			if (target.finishedAfterMonths === null) {
				target.monthlyCents += finished.monthlyCents;
				return;
			}
			visitedIds.add(targetId);
			targetId = fundingById.get(targetId)?.rollsTo ?? null;
		}
	}

	private toOutcome(running: RunningGoal): GoalOutcome {
		const { finishedAfterMonths } = running;
		if (finishedAfterMonths === null) return { finishMonth: null, interest: null, path: [running.path[0] ?? 0] };
		return {
			finishMonth: this.calendar.addMonths(this.calendar.currentMonth(), finishedAfterMonths),
			interest: running.interestCents / CENTS_PER_DOLLAR,
			path: running.path
		};
	}
}
