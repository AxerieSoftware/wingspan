import { describe, expect, it } from 'vitest';
import type { MonarchClient } from './monarchClient';
import { MonarchGoalsClient } from './monarchGoalsClient';

const goal = (linkedAccounts: { id: string; growthRate: number | null; subtype?: { name: string } }[], allocations: { id: string; amount: number }[]) => ({
	id: 'goal',
	name: 'Nest Egg',
	currentBalance: 1000,
	targetAmount: 50000,
	targetDate: null,
	// The schema gives Monarch's missing subtype as null, which this fake client skips.
	linkedAccounts: linkedAccounts.map(account => ({ subtype: null, ...account })),
	allocationAmountsByAccount: allocations.map(({ id, amount }) => ({ account: { id }, totalAmount: amount })),
	monthlyBudgetAmounts: [{ totalPlannedAmount: 300 }]
});
const plansOf = (savingsGoal: ReturnType<typeof goal>) =>
	new MonarchGoalsClient({ request: async () => ({ savingsGoals: [savingsGoal], debtAccounts: [] }) } as unknown as MonarchClient).getGoalPlans('2026-10');

describe("a savings goal's growth", () => {
	// Invariant: the rate is each linked account's rate weighted by what it holds toward the goal, or evenly before any holds anything.
	it("weights each linked account's rate by what it holds toward the goal", async () => {
		const plans = await plansOf(
			goal(
				[
					{ id: 'savings', growthRate: 4 },
					{ id: 'brokerage', growthRate: 7 }
				],
				[
					{ id: 'savings', amount: 3000 },
					{ id: 'brokerage', amount: 1000 }
				]
			)
		);

		expect(plans.savingsGoals[0]?.growthRate).toBeCloseTo(4.75, 9);
	});

	it('weights them evenly before any holds anything, and is 0 with no linked account', async () => {
		expect(
			(
				await plansOf(
					goal(
						[
							{ id: 'savings', growthRate: 4 },
							{ id: 'brokerage', growthRate: null }
						],
						[]
					)
				)
			).savingsGoals[0]?.growthRate
		).toBe(2);
		expect((await plansOf(goal([], []))).savingsGoals[0]?.growthRate).toBe(0);
	});

	it("is paid from payroll when linked to an employer plan like a 401(k), and takes its month's total planned amount", async () => {
		const plans = await plansOf(goal([{ id: '401k', growthRate: 7, subtype: { name: 'st_401k' } }], []));

		expect(plans.savingsGoals[0]).toMatchObject({ isPaidFromPayroll: true, monthlyContribution: 300 });
	});
});
