/** The amount budgeted for one savings goal in one month, and how much of it is left. */
export interface GoalContribution {
	goalName: string;
	/** "YYYY-MM". */
	month: string;
	planned: number;
	remaining: number;
}
