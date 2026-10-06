import type { Calendar } from '../../../../common/calendar';
import { roundToCents } from '../../../../common/money';
import type { GoalContribution } from '../../../../monarch/api/models/goalContribution';
import type { FreeCashSplit } from '../models/freeCashSplit';

/**
 * Promised is the rest of this month's planned goal contributions in Monarch's budget, plus each later month's
 * planned contribution if that month starts before the window ends.
 */
export class FreeCashSplitter {
	public constructor(private readonly calendar: Calendar) {}

	/** trulyFree is free cash minus what's promised; goals are sorted largest first. */
	public split(freeCash: number, contributions: GoalContribution[], windowEnd: string): FreeCashSplit {
		const currentMonth = this.calendar.currentMonth();
		const lastMonth = this.calendar.monthOf(windowEnd);
		const promisedByGoal = new Map<string, number>();
		for (const contribution of contributions) {
			if (contribution.month < currentMonth || contribution.month > lastMonth) continue;
			const amount = contribution.month === currentMonth ? contribution.remaining : contribution.planned;
			if (amount > 0) promisedByGoal.set(contribution.goalName, (promisedByGoal.get(contribution.goalName) ?? 0) + amount);
		}

		const promised = [...promisedByGoal.values()].reduce((total, amount) => total + amount, 0);
		return {
			promised,
			trulyFree: roundToCents(freeCash - promised),
			goals: [...promisedByGoal].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
		};
	}
}
