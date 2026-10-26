import * as v from 'valibot';
import type { CategoryMonthTotal } from './models/categoryMonthTotal';
import type { GoalContribution } from './models/goalContribution';
import type { MonthBudget } from './models/monthBudget';
import type { MonarchClient } from './monarchClient';

const GET_GOAL_CONTRIBUTIONS_QUERY = `
	query wingspan_GetGoalContributions($startMonth: Date!, $endMonth: Date!) {
		savingsGoalMonthlyBudgetAmounts(startMonth: $startMonth, endMonth: $endMonth) {
			savingsGoal { id name archivedAt }
			monthlyAmounts { month plannedAmount remainingAmount }
		}
	}
`;

const GET_CATEGORY_MONTH_TOTALS_QUERY = `
	query wingspan_GetCategoryMonthTotals($startDate: Date!, $endDate: Date!) {
		aggregates(filters: { startDate: $startDate, endDate: $endDate }, groupBy: ["category", "month"], fillEmptyValues: true) {
			groupBy { category { id group { type } } month }
			summary { sum }
		}
	}
`;

const GET_MONTH_BUDGETS_QUERY = `
	query wingspan_GetMonthBudgets($startMonth: Date!, $endMonth: Date!) {
		budgetData(startMonth: $startMonth, endMonth: $endMonth) {
			totalsByMonth { month totalIncome { plannedAmount } totalExpenses { plannedAmount } }
		}
	}
`;

const MonthBudgetsSchema = v.object({
	budgetData: v.object({
		totalsByMonth: v.array(
			v.object({
				month: v.string(),
				totalIncome: v.object({ plannedAmount: v.nullish(v.number(), 0) }),
				totalExpenses: v.object({ plannedAmount: v.nullish(v.number(), 0) })
			})
		)
	})
});

const GET_CATEGORY_TOTALS_QUERY = `
	query wingspan_GetCategoryTotals($filters: TransactionFilterInput) {
		aggregates(filters: $filters, groupBy: ["category"]) {
			groupBy { category { id group { type } } }
			summary { sum }
		}
	}
`;

const CategoryAggregatesSchema = v.object({
	aggregates: v.array(
		v.object({
			groupBy: v.object({ category: v.nullish(v.object({ id: v.string(), group: v.object({ type: v.string() }) })), month: v.nullish(v.string()) }),
			summary: v.object({ sum: v.nullish(v.number(), 0) })
		})
	)
});

const GoalContributionsSchema = v.object({
	savingsGoalMonthlyBudgetAmounts: v.array(
		v.object({
			savingsGoal: v.object({ id: v.string(), name: v.string(), archivedAt: v.nullish(v.string()) }),
			monthlyAmounts: v.array(v.nullable(v.object({ month: v.string(), plannedAmount: v.nullish(v.number()), remainingAmount: v.nullish(v.number()) })))
		})
	)
});

/** Reads the household's budgeted amounts for its savings goals, and what each category came to by month. */
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

	/** The income and expenses budgeted for each month Monarch has a budget for, from the start month through the end month ("YYYY-MM"). */
	public async getMonthBudgets(startMonth: string, endMonth: string): Promise<MonthBudget[]> {
		const { budgetData } = await this.client.request('wingspan_GetMonthBudgets', GET_MONTH_BUDGETS_QUERY, MonthBudgetsSchema, { startMonth: `${startMonth}-01`, endMonth: `${endMonth}-01` });
		return budgetData.totalsByMonth.map(totals => ({ month: totals.month.slice(0, 7), plannedIncome: totals.totalIncome.plannedAmount, plannedExpenses: totals.totalExpenses.plannedAmount }));
	}

	/**
	 * Each expense category's spending in those dates, on the accounts given or with any of the tags given. Accounts in
	 * `excludeAccountIds` are left out. Keyed by category id.
	 */
	public async getCategorySpending(filter: { startDate: string; endDate: string; accountIds?: string[]; tagIds?: string[]; excludeAccountIds?: string[] }): Promise<Map<string, number>> {
		const { startDate, endDate, accountIds, tagIds, excludeAccountIds } = filter;
		const { aggregates } = await this.client.request('wingspan_GetCategoryTotals', GET_CATEGORY_TOTALS_QUERY, CategoryAggregatesSchema, {
			filters: {
				startDate,
				endDate,
				...(accountIds ? { accounts: accountIds } : {}),
				...(tagIds ? { tags: tagIds } : {}),
				...(excludeAccountIds?.length ? { excludeAccounts: excludeAccountIds } : {})
			}
		});
		return new Map(aggregates.flatMap(({ groupBy: { category }, summary }) => (category?.group.type === 'expense' ? [[category.id, -summary.sum] as const] : [])));
	}

	/** Each income and expense category's total for every month in those dates, the same totals Monarch's budget History charts. */
	public async getCategoryMonthTotals(startDate: string, endDate: string): Promise<CategoryMonthTotal[]> {
		const { aggregates } = await this.client.request('wingspan_GetCategoryMonthTotals', GET_CATEGORY_MONTH_TOTALS_QUERY, CategoryAggregatesSchema, { startDate, endDate });
		return aggregates.flatMap(({ groupBy: { category, month }, summary }) => {
			const type = category?.group.type;
			if (!category || !month || (type !== 'income' && type !== 'expense')) return [];
			// Monarch sums expenses as negative amounts.
			return [{ categoryId: category.id, month: month.slice(0, 7), amount: type === 'expense' ? -summary.sum : summary.sum }];
		});
	}
}
