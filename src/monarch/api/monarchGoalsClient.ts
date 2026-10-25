import * as v from 'valibot';
import { roundToCents } from '../../common/money';
import type { GoalPlans } from './models/goalPlans';
import { MonarchApiError } from './monarchApiError';
import type { MonarchClient } from './monarchClient';
import { ensureMutationSucceeded, MutationPayloadSchema } from './mutationPayload';

const EMPLOYER_PLAN_SUBTYPES = new Set(['thrift_savings_plan', 'simple_ira', 'sep_ira', 'sarsep_pension', 'profit_sharing_plan']);

const GET_GOAL_PLANS_QUERY = `
	query wingspan_GetGoalPlans($month: Date!) {
		savingsGoals {
			id name currentBalance targetAmount targetDate archivedAt completedAt
			linkedAccounts { id growthRate subtype { name } }
			allocationAmountsByAccount { account { id } totalAmount }
			monthlyBudgetAmounts(startMonth: $month, endMonth: $month) { totalPlannedAmount }
		}
		debtAccounts { id displayName currentBalance interestRate apr plannedPayment minimumPayment excludeFromDebtPaydown isHidden }
	}
`;

const GET_MONTHLY_AMOUNTS_QUERY = `
	query wingspan_GetGoalMonthlyAmounts($ids: [ID!], $month: Date!) {
		savingsGoals(ids: $ids) {
			id name
			linkedAccounts { id }
			monthlyBudgetAmounts(startMonth: $month, endMonth: $month) { plannedAmount totalPlannedAmount accountBreakdown { account { id } plannedAmount } }
		}
		debtAccounts { id displayName plannedPayment minimumPayment }
	}
`;

const SET_MONTH_CONTRIBUTION_MUTATION = `
	mutation wingspan_SetGoalMonthContribution($input: SetSavingsGoalBudgetAmountInput!) {
		setSavingsGoalBudgetAmount(input: $input) { success errors { message } }
	}
`;

const SET_PLANNED_PAYMENT_MUTATION = `
	mutation wingspan_SetPlannedPayment($input: UpdateAccountMutationInput!) {
		updateAccount(input: $input) { account { id } errors { message } }
	}
`;

const MonthlyAmountsSchema = v.object({
	savingsGoals: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			linkedAccounts: v.nullish(v.array(v.object({ id: v.string() })), []),
			monthlyBudgetAmounts: v.array(
				v.object({
					plannedAmount: v.nullish(v.number(), 0),
					totalPlannedAmount: v.nullish(v.number(), 0),
					accountBreakdown: v.array(v.object({ account: v.object({ id: v.string() }), plannedAmount: v.nullish(v.number(), 0) }))
				})
			)
		})
	),
	debtAccounts: v.array(v.object({ id: v.string(), displayName: v.string(), plannedPayment: v.nullish(v.number(), null), minimumPayment: v.nullish(v.number(), null) }))
});
const SetMonthContributionSchema = v.object({ setSavingsGoalBudgetAmount: MutationPayloadSchema({}) });
const SetPlannedPaymentSchema = v.object({ updateAccount: MutationPayloadSchema({}) });

const GoalPlansSchema = v.object({
	savingsGoals: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			currentBalance: v.nullish(v.number(), 0),
			targetAmount: v.nullish(v.number(), null),
			targetDate: v.nullish(v.string(), null),
			archivedAt: v.nullish(v.string(), null),
			completedAt: v.nullish(v.string(), null),
			linkedAccounts: v.nullish(v.array(v.object({ id: v.string(), growthRate: v.nullish(v.number(), null), subtype: v.nullish(v.object({ name: v.string() }), null) })), []),
			allocationAmountsByAccount: v.nullish(v.array(v.object({ account: v.object({ id: v.string() }), totalAmount: v.nullish(v.number(), 0) })), []),
			monthlyBudgetAmounts: v.array(v.object({ totalPlannedAmount: v.nullish(v.number(), 0) }))
		})
	),
	debtAccounts: v.array(
		v.object({
			id: v.string(),
			displayName: v.string(),
			currentBalance: v.nullish(v.number(), 0),
			interestRate: v.nullish(v.number(), null),
			apr: v.nullish(v.number(), null),
			plannedPayment: v.nullish(v.number(), null),
			minimumPayment: v.nullish(v.number(), null),
			excludeFromDebtPaydown: v.nullish(v.boolean(), false),
			isHidden: v.nullish(v.boolean(), false)
		})
	)
});

/** Reads the household's savings goals and the debts on Monarch's Pay down page. */
export class MonarchGoalsClient {
	public constructor(private readonly client: MonarchClient) {}

	/**
	 * Open savings goals with what's planned for each in `month` ("YYYY-MM"), and owed debts with an interest rate and a
	 * monthly payment, as Pay down needs them set up to project a payoff.
	 */
	public async getGoalPlans(month: string): Promise<GoalPlans> {
		const { savingsGoals, debtAccounts } = await this.client.request('wingspan_GetGoalPlans', GET_GOAL_PLANS_QUERY, GoalPlansSchema, { month: `${month}-01` });
		return {
			savingsGoals: savingsGoals.flatMap(goal =>
				goal.archivedAt || goal.completedAt
					? []
					: [
							{
								id: goal.id,
								name: goal.name,
								balance: goal.currentBalance,
								target: goal.targetAmount || null,
								targetDate: goal.targetDate,
								// Its general contribution plus each account's, which `plannedMonthlyContribution` leaves out.
								monthlyContribution: goal.monthlyBudgetAmounts[0]?.totalPlannedAmount ?? 0,
								growthRate: growthRateOf(goal.linkedAccounts, goal.allocationAmountsByAccount),
								isPaidFromPayroll: goal.linkedAccounts.some(account => account.subtype !== null && isEmployerPlan(account.subtype.name))
							}
						]
			),
			debts: debtAccounts.flatMap(account => {
				const interestRate = account.interestRate ?? account.apr;
				const monthlyPayment = monthlyPaymentOf(account);
				const owed = Math.abs(account.currentBalance);
				if (account.excludeFromDebtPaydown || account.isHidden || owed <= 0 || interestRate === null || monthlyPayment === null || monthlyPayment <= 0) return [];
				return [{ id: account.id, name: account.displayName, owed, interestRate, monthlyPayment, minimumPayment: account.minimumPayment }];
			})
		};
	}

	/**
	 * Sets what's planned a month in all for savings goals and debts, each by id, so saving again sets the same amounts.
	 * A savings goal's difference goes, from `month` ("YYYY-MM") on, to its linked account when it has just one, where
	 * Monarch grows it, or else to its general contribution. A debt's total becomes its planned payment on Pay down.
	 * Every amount is checked before any is set.
	 */
	public async setMonthlyAmounts(goalTotals: ReadonlyMap<string, number>, debtTotals: ReadonlyMap<string, number>, month: string): Promise<void> {
		const monthDate = `${month}-01`;
		const { savingsGoals, debtAccounts } = await this.client.request('wingspan_GetGoalMonthlyAmounts', GET_MONTHLY_AMOUNTS_QUERY, MonthlyAmountsSchema, {
			ids: [...goalTotals.keys()],
			month: monthDate
		});
		// An empty list of ids gets every goal back.
		const goalUpdates = savingsGoals.flatMap(goal => {
			const total = goalTotals.get(goal.id);
			if (total === undefined) return [];
			const accountId = goal.linkedAccounts.length === 1 ? (goal.linkedAccounts[0]?.id ?? null) : null;
			const monthAmounts = goal.monthlyBudgetAmounts[0];
			const planned = accountId ? (monthAmounts?.accountBreakdown.find(entry => entry.account.id === accountId)?.plannedAmount ?? 0) : (monthAmounts?.plannedAmount ?? 0);
			const amount = roundToCents(planned + total - (monthAmounts?.totalPlannedAmount ?? 0));
			if (amount < 0) throw new MonarchApiError(`${goal.name} doesn't have that much planned in one place to take off. Lower it in Monarch instead.`, false);
			return [{ savingsGoalId: goal.id, accountId, amount, month: monthDate, applyToFuture: true }];
		});
		const paymentUpdates = debtAccounts.flatMap(account => {
			const total = debtTotals.get(account.id);
			return total === undefined ? [] : [{ id: account.id, plannedPayment: roundToCents(total) }];
		});

		for (const input of goalUpdates) {
			const { setSavingsGoalBudgetAmount } = await this.client.request('wingspan_SetGoalMonthContribution', SET_MONTH_CONTRIBUTION_MUTATION, SetMonthContributionSchema, { input });
			ensureMutationSucceeded(setSavingsGoalBudgetAmount, { logMessage: 'setSavingsGoalBudgetAmount was rejected.', userMessage: "Monarch didn't save a goal's new monthly amount." });
		}
		for (const input of paymentUpdates) {
			const { updateAccount } = await this.client.request('wingspan_SetPlannedPayment', SET_PLANNED_PAYMENT_MUTATION, SetPlannedPaymentSchema, { input });
			ensureMutationSucceeded(updateAccount, { logMessage: 'updateAccount was rejected for a planned payment.', userMessage: "Monarch didn't save a debt's new payment." });
		}
	}
}

/** Monarch's subtypes for retirement plans paid into from pay: 401(k)s, 403(b)s, 457(b)s, the TSP and employer IRAs. */
function isEmployerPlan(subtype: string): boolean {
	return /401|403b|457/.test(subtype) || EMPLOYER_PLAN_SUBTYPES.has(subtype);
}

/** What Pay down counts as paid a month: the planned payment, or the minimum without one. */
function monthlyPaymentOf(account: { plannedPayment: number | null; minimumPayment: number | null }): number | null {
	return account.plannedPayment ?? account.minimumPayment;
}

/**
 * Monarch grows a goal's money only in accounts linked to it whole. Weighted by what each holds toward the goal, or
 * evenly before any holds anything.
 */
function growthRateOf(linkedAccounts: { id: string; growthRate: number | null }[], allocations: { account: { id: string }; totalAmount: number }[]): number {
	if (!linkedAccounts.length) return 0;
	const heldById = new Map(allocations.map(allocation => [allocation.account.id, Math.max(0, allocation.totalAmount)]));
	const totalHeld = linkedAccounts.reduce((total, account) => total + (heldById.get(account.id) ?? 0), 0);
	const weightOf = (account: { id: string }) => (totalHeld > 0 ? (heldById.get(account.id) ?? 0) / totalHeld : 1 / linkedAccounts.length);
	return linkedAccounts.reduce((rate, account) => rate + (account.growthRate ?? 0) * weightOf(account), 0);
}
