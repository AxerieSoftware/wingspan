import * as v from 'valibot';
import type { GoalContribution } from './models/goalContribution';
import type { MonarchClient } from './monarchClient';

const GET_GOAL_CONTRIBUTIONS_QUERY = `
	query wingspan_GetGoalContributions($startMonth: Date!, $endMonth: Date!) {
		savingsGoalMonthlyBudgetAmounts(startMonth: $startMonth, endMonth: $endMonth) {
			savingsGoal { id name archivedAt }
			monthlyAmounts { month plannedAmount remainingAmount }
		}
	}
`;

const GoalContributionsSchema = v.object({
	savingsGoalMonthlyBudgetAmounts: v.array(
		v.object({
			savingsGoal: v.object({ id: v.string(), name: v.string(), archivedAt: v.nullish(v.string()) }),
			monthlyAmounts: v.array(v.nullable(v.object({ month: v.string(), plannedAmount: v.nullish(v.number()), remainingAmount: v.nullish(v.number()) })))
		})
	)
});

/** Reads the household's budgeted amounts for its savings goals. */
export class MonarchBudgetClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Months are "YYYY-MM". */
	public async getGoalContributions(startMonth: string, endMonth: string): Promise<GoalContribution[]> {
		const { savingsGoalMonthlyBudgetAmounts } = await this.client.request('wingspan_GetGoalContributions', GET_GOAL_CONTRIBUTIONS_QUERY, GoalContributionsSchema, {
			startMonth: `${startMonth}-01`,
			endMonth: `${endMonth}-01`
		});
		return savingsGoalMonthlyBudgetAmounts
			.filter(({ savingsGoal }) => !savingsGoal.archivedAt)
			.flatMap(({ savingsGoal, monthlyAmounts }) =>
				monthlyAmounts
					.filter(amounts => amounts !== null)
					.map(amounts => ({ goalName: savingsGoal.name, month: amounts.month.slice(0, 7), planned: amounts.plannedAmount ?? 0, remaining: Math.max(0, amounts.remainingAmount ?? 0) }))
			)
			.filter(contribution => contribution.planned > 0);
	}
}
