import { CENTS_PER_DOLLAR, toCents } from '../../../../common/money';
import { median } from '../../../../common/statistics';
import type { GoalPlans } from '../../../../monarch/api/models/goalPlans';
import type { MonthBudget } from '../../../../monarch/api/models/monthBudget';

/**
 * What a month leaves for goals, two ways: at the household's typical spending, and by its budget. They can differ,
 * as when the budget plans less spending than the household usually does.
 */
export interface GoalRoom {
	/** Income less bills and everyday spending in a normal month, from Projected balances. Null without a projection. */
	surplus: number | null;
	/** Months of the year ahead that bring in more than a normal one, as with a third paycheck, by typical spending. */
	surplusExtraMonths: ExtraMonths | null;
	/** Budgeted income less budgeted expenses in a normal month of the year ahead. Null without a budget. */
	budgetLeft: number | null;
	/** Months of the year ahead whose budget leaves more than a normal one, as with a third paycheck. */
	budgetExtraMonths: ExtraMonths | null;
	/** Planned a month for savings goals paid from take-home pay, which neither way counts already. */
	plannedForSavings: number;
	/** Planned a month for debts beyond their bills. Typical spending doesn't count it; the budget does, as an expense. */
	plannedForDebts: number;
	/** More take-home pay a month the household is trying out, like extra hours. */
	extraIncome: number;
}

/**
 * How much more than a normal month's income a month has to bring in to count as one with an extra paycheck. A third
 * biweekly paycheck is half again a normal month, and a fifth weekly one a quarter, while ordinary ups and downs, like
 * a budget planning a little more pay one month, are smaller.
 */
const EXTRA_PAYCHECK_SHARE = 0.2;

/** Months that bring in more than a normal one, and about how much more each does. */
export interface ExtraMonths {
	count: number;
	eachAbout: number;
}

/** What a normal month of the budget leaves, and the months with more income, which planning month by month can't count on. */
export interface BudgetMonths {
	left: number;
	extraMonths: ExtraMonths | null;
}

/**
 * What the budget leaves in a normal month, the median of the months, so a month with an extra paycheck doesn't make
 * every month look roomier. Months budgeting an extra paycheck's worth more income than the median are the extra ones,
 * each with what it leaves above the normal month. Null without any budgeted month.
 *
 * Invariant, in whole cents: the normal month is the median of each month's planned income less planned expenses.
 */
export function budgetMonthsOf(budgets: readonly MonthBudget[]): BudgetMonths | null {
	if (!budgets.length) return null;
	const leftCents = budgets.map(budget => toCents(budget.plannedIncome) - toCents(budget.plannedExpenses));
	const normalLeftCents = Math.round(median(leftCents));
	const months = budgets.map((budget, index) => ({ incomeCents: toCents(budget.plannedIncome), extraCents: (leftCents[index] ?? 0) - normalLeftCents }));
	return { left: normalLeftCents / CENTS_PER_DOLLAR, extraMonths: extraMonthsOf(months, Math.round(median(months.map(month => month.incomeCents)))) };
}

/** The months bringing in an extra paycheck's worth more than a normal month's income, with what each adds. Null for none. */
export function extraMonthsOf(months: readonly { incomeCents: number; extraCents: number }[], normalIncomeCents: number): ExtraMonths | null {
	const extraCents = months.filter(month => month.incomeCents - normalIncomeCents >= normalIncomeCents * EXTRA_PAYCHECK_SHARE && month.extraCents > 0).map(month => month.extraCents);
	if (!extraCents.length) return null;
	return { count: extraCents.length, eachAbout: extraCents.reduce((total, cents) => total + cents, 0) / extraCents.length / CENTS_PER_DOLLAR };
}

/** The room left each way after a change in what goes toward goals each month. */
export interface RoomLeft {
	typical: number | null;
	budget: number | null;
}

/**
 * Invariant, in whole cents: each way's room is its starting amount less what's planned for savings, and for typical
 * spending also for debts beyond their bills, plus extra income, less the change.
 */
export function roomLeft(room: GoalRoom, change: number): RoomLeft {
	const roomAfterChange = (startingRoom: number | null, plannedCents: number) =>
		startingRoom === null ? null : (toCents(startingRoom) - plannedCents + toCents(room.extraIncome) - toCents(change)) / CENTS_PER_DOLLAR;
	return {
		typical: roomAfterChange(room.surplus, toCents(room.plannedForSavings) + toCents(room.plannedForDebts)),
		budget: roomAfterChange(room.budgetLeft, toCents(room.plannedForSavings))
	};
}

/** What goals take from the room each month, from `plannedOutOfRoom`. */
export interface PlannedOutOfRoom {
	savings: number;
	debts: number;
}

/**
 * What goals take from the room each month: what's planned for savings goals paid from take-home pay, and what's
 * planned for debts beyond what's already a bill. A goal paid into from pay, like a 401(k), was never in take-home pay.
 * A debt's bills are the recurring payments linked to it, as with a second payment for the extra, or else its minimum.
 * A debt with neither counts as paid at its plan.
 *
 * Invariant, in whole cents: savings is those savings goals' amounts, and debts is those debts' amounts beyond their bills.
 */
export function plannedOutOfRoom({ savingsGoals, debts }: GoalPlans, linkedPaymentsByDebtId: ReadonlyMap<string, number>): PlannedOutOfRoom {
	const savingsCents = savingsGoals.reduce((total, goal) => total + (goal.isPaidFromPayroll ? 0 : toCents(goal.monthlyContribution)), 0);
	const beyondBillsCents = debts.reduce((total, debt) => {
		const billed = linkedPaymentsByDebtId.get(debt.id) ?? debt.minimumPayment ?? debt.monthlyPayment;
		return total + Math.max(0, toCents(debt.monthlyPayment) - toCents(billed));
	}, 0);
	return { savings: savingsCents / CENTS_PER_DOLLAR, debts: beyondBillsCents / CENTS_PER_DOLLAR };
}
