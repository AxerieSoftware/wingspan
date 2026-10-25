import { describe, expect, it } from 'vitest';
import { budgetMonthsOf, plannedOutOfRoom, roomLeft } from './goalRoom';

const room = { surplus: 1250.1, surplusExtraMonths: null, budgetLeft: 7505, budgetExtraMonths: null, plannedForSavings: 250, plannedForDebts: 0, extraIncome: 0 };

describe('the room left for goals', () => {
	// Invariant: each way, room is its starting amount less savings planned, plus extra income, less the change, to the cent.
	it('takes what is planned for savings and any change out of both the typical surplus and the budget', () => {
		expect(roomLeft(room, 0)).toEqual({ typical: 1000.1, budget: 7255 });
		expect(roomLeft(room, 300.2)).toEqual({ typical: 699.9, budget: 6954.8 });
	});

	it('takes debt payments beyond their bills from typical spending only, since the budget has them as expenses', () => {
		expect(roomLeft({ ...room, plannedForDebts: 500 }, 0)).toEqual({ typical: 500.1, budget: 7255 });
	});

	it('adds extra income to both, so a raise in hours makes room either way', () => {
		expect(roomLeft({ ...room, extraIncome: 800 }, 300.2)).toEqual({ typical: 1499.9, budget: 7754.8 });
	});

	it('goes below $0 when the plan takes more than there is, and is unknown without a projection or a budget', () => {
		expect(roomLeft({ ...room, surplus: 100 }, 0).typical).toBe(-150);
		expect(roomLeft({ ...room, surplus: null, budgetLeft: null }, 0)).toEqual({ typical: null, budget: null });
	});
});

describe('what goals take from the room', () => {
	const savingsGoal = { id: 'vacation', name: 'Vacation', balance: 0, target: 5000, targetDate: null, monthlyContribution: 400.1, growthRate: 0, isPaidFromPayroll: false };
	const debt = { id: 'loan', name: 'Loan', owed: 18200, interestRate: 5.42, monthlyPayment: 2865.39, minimumPayment: 365.39 };

	// Invariant: savings goals paid from take-home pay plus debts' payments above their minimums, to the cent.
	it("counts savings from take-home pay and debt payments above their minimums, but not a 401(k)'s or a minimum", () => {
		const retirement = { ...savingsGoal, id: '401k', monthlyContribution: 900, isPaidFromPayroll: true };
		const card = { ...debt, id: 'card', monthlyPayment: 2602, minimumPayment: null };

		expect(plannedOutOfRoom({ savingsGoals: [savingsGoal, retirement], debts: [debt, card] }, new Map())).toEqual({ savings: 400.1, debts: 2500 });
	});

	it("counts a debt's linked recurring payments as bills already, so a second payment for the extra isn't taken twice", () => {
		expect(plannedOutOfRoom({ savingsGoals: [], debts: [debt] }, new Map([['loan', 2865.39]])).debts).toBe(0);
		expect(plannedOutOfRoom({ savingsGoals: [], debts: [debt] }, new Map([['loan', 2365.39]])).debts).toBe(500);
	});
});

describe("the budget's room", () => {
	const month = (index: number, plannedIncome: number, plannedExpenses: number) => ({ month: `2027-${String(index + 1).padStart(2, '0')}`, plannedIncome, plannedExpenses });

	// Invariant: the normal month is the median of what each month leaves, to the cent.
	it('is what a normal month leaves, with months budgeting a third paycheck shown on their own', () => {
		const budgets = Array.from({ length: 12 }, (_, index) => month(index, 10631, 9714));
		budgets[0] = month(0, 14339.5, 9714);
		budgets[6] = month(6, 14339.5, 9714);

		expect(budgetMonthsOf(budgets)).toEqual({ left: 917, extraMonths: { count: 2, eachAbout: 3708.5 } });
	});

	it("doesn't take a month budgeting a little more pay for one with an extra paycheck", () => {
		const budgets = Array.from({ length: 12 }, (_, index) => month(index, 10631 + (index % 2) * 150, 9714));

		expect(budgetMonthsOf(budgets)?.extraMonths).toBeNull();
	});

	it('has no extra months when every month budgets the same income, and is unknown without any budgeted month', () => {
		expect(budgetMonthsOf([month(0, 6400, 1930), month(1, 6400, 2130)])).toEqual({ left: 4370, extraMonths: null });
		expect(budgetMonthsOf([])).toBeNull();
	});
});
