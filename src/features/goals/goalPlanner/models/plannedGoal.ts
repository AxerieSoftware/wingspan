/** A savings goal or a debt in the planner, with what goes toward it each month in Monarch now. */
export type PlannedGoal =
	| { kind: 'saving'; id: string; name: string; monthly: number; balance: number; target: number; targetDate: string | null; growthRate: number }
	| { kind: 'debt'; id: string; name: string; monthly: number; owed: number; interestRate: number; minimumPayment: number | null };

/** Where a goal ends up at some monthly amount. */
export interface GoalOutcome {
	/** The month, "YYYY-MM", it's reached or paid off. Null when it never is at that amount. */
	finishMonth: string | null;
	/** Interest paid until a debt is paid off, or growth earned until a savings goal is reached. Null when it never finishes. */
	interest: number | null;
	/** The balance saved, or still owed, at the end of each month from now until it finishes, starting with today's. */
	path: number[];
}

/** Whether the outcome reaches its goal by the end of the month of `targetDate`, "YYYY-MM-DD". */
export function isByTarget(outcome: GoalOutcome, targetDate: string): boolean {
	return outcome.finishMonth !== null && outcome.finishMonth <= targetDate.slice(0, 7);
}
