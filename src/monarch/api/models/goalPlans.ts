/** A savings goal in Monarch that money goes toward each month. */
export interface SavingsGoal {
	id: string;
	name: string;
	balance: number;
	/** Null when the goal has no target amount, or a $0 one, as with an open-ended fund. */
	target: number | null;
	/** "YYYY-MM-DD", or null when the goal has no target date. */
	targetDate: string | null;
	monthlyContribution: number;
	/** Yearly, as a percentage, like 3.5: its linked accounts' growth rates, weighted by what each holds toward it. 0 without any. */
	growthRate: number;
	/** Linked to an employer plan, like a 401(k), so what's planned for it comes out of pay before it reaches the household. */
	isPaidFromPayroll: boolean;
}

/** A loan or card on Monarch's Pay down page, with what's owed and what's paid on it each month. */
export interface DebtAccount {
	id: string;
	name: string;
	owed: number;
	/** Yearly, as a percentage, like 5.42. */
	interestRate: number;
	monthlyPayment: number;
	/** The least that's due a month, or null when Monarch doesn't have one, as for many cards. */
	minimumPayment: number | null;
}

/** The household's open savings goals and the debts it pays down. */
export interface GoalPlans {
	savingsGoals: SavingsGoal[];
	debts: DebtAccount[];
}
