import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import { roundToCents, toCents } from '../../../../common/money';
import type { PlannedGoal } from '../models/plannedGoal';
import { type GoalFunding, GoalProjector } from './goalProjector';

const projector = new GoalProjector(new Calendar(() => Temporal.PlainDate.from('2026-10-24')));
const saving = (id: string, balance: number, target: number, growthRate = 0): PlannedGoal & { kind: 'saving' } => ({
	kind: 'saving',
	id,
	name: id,
	monthly: 0,
	balance,
	target,
	targetDate: null,
	growthRate
});
const debt = (id: string, owed: number, interestRate: number): PlannedGoal => ({ kind: 'debt', id, name: id, monthly: 0, owed, interestRate, minimumPayment: null });
const funding = (entries: [string, number, string?][]) => new Map<string, GoalFunding>(entries.map(([id, monthly, rollsTo]) => [id, { monthly, rollsTo: rollsTo ?? null }]));
const projectOne = (goal: PlannedGoal, monthly: number) => projector.project([goal], funding([[goal.id, monthly]])).get(goal.id);

describe('projecting a savings goal', () => {
	// Invariant: the months taken are the fewest whose contributions cover what's left, never passing the target.
	it('reaches the target in the fewest months whose contributions cover the rest, starting next month', () => {
		const outcome = projectOne(saving('vacation', 1432.34, 5000), 300);

		expect(outcome?.finishMonth).toBe('2027-10');
		expect(outcome?.path).toHaveLength(13);
		expect(outcome?.path.at(-1)).toBe(5000);
		expect(toCents(outcome?.path.at(-2) ?? 0)).toBeLessThan(toCents(5000));
	});

	it('is never reached with nothing going toward it, and is done already once the balance covers the target', () => {
		expect(projectOne(saving('vacation', 0, 5000), 0)?.finishMonth).toBeNull();
		expect(projectOne(saving('vacation', 5200, 5000), 0)).toEqual({ finishMonth: '2026-10', interest: 0, path: [5200] });
	});
});

describe('growing a savings goal', () => {
	// Invariant: each month adds a month's growth on what's saved, rounded to the cent, plus what goes in, never passing the target.
	it("adds a month's growth on what's saved before what goes in, up to the target", () => {
		const outcome = projectOne(saving('nest egg', 10000, 11000, 4.5), 200);
		const path = outcome?.path ?? [];
		const steps = path.slice(1).map((saved, index) => toCents(saved) - toCents(path[index] ?? 0));
		const growths = path.slice(0, -2).map(saved => toCents(roundToCents(saved * (4.5 / 100 / 12))));

		expect(steps.slice(0, -1)).toEqual(growths.map(growthCents => growthCents + toCents(200)));
		expect(path.at(-1)).toBe(11000);
		expect(toCents(outcome?.interest ?? 0)).toBeGreaterThan(0);
	});

	it('is reached by growth alone, with nothing going toward it', () => {
		expect(projectOne(saving('nest egg', 9900, 10000, 6), 0)?.finishMonth).toBe('2027-01');
	});
});

describe('the amount needed a month for a target date', () => {
	const reachesBy = (goal: PlannedGoal, monthly: number, targetMonth: string) => (projectOne(goal, monthly)?.finishMonth ?? '9999-12') <= targetMonth;

	// Invariant: the amount reaches the target by the end of its month, and a cent less doesn't.
	it('is the least amount, to the cent, that reaches the target by the end of its month', () => {
		for (const goal of [saving('vacation', 1432.34, 5000), saving('college', 2500, 100000, 6)]) {
			const needed = projector.neededMonthly(goal, '2040-01') ?? 0;

			expect(reachesBy(goal, needed, '2040-01')).toBe(true);
			expect(reachesBy(goal, roundToCents(needed - 0.01), '2040-01')).toBe(false);
		}
	});

	it('is less when the goal grows, nothing when growth alone gets there, and none once the target month has passed', () => {
		expect(projector.neededMonthly(saving('college', 2500, 100000, 6), '2040-01') ?? 0).toBeLessThan(projector.neededMonthly(saving('college', 2500, 100000), '2040-01') ?? 0);
		expect(projector.neededMonthly(saving('nest egg', 9900, 10000, 6), '2027-06')).toBe(0);
		expect(projector.neededMonthly(saving('vacation', 0, 5000), '2026-10')).toBeNull();
	});
});

describe('projecting a debt', () => {
	// Invariant: every payment is the monthly amount except a smaller last one, and the interest is each month's charge summed.
	it('pays the monthly amount each month until a smaller last payment, summing interest month by month', () => {
		const outcome = projectOne(debt('loan', 18200.36, 5.42), 365.39);
		const path = outcome?.path ?? [];
		const months = path.slice(1).map((owed, index) => {
			const owedBefore = path[index] ?? 0;
			const interestCents = toCents(roundToCents(owedBefore * (5.42 / 100 / 12)));
			return { interestCents, paymentCents: toCents(owedBefore) + interestCents - toCents(owed) };
		});

		expect(path.at(-1)).toBe(0);
		expect(months.slice(0, -1).every(month => month.paymentCents === toCents(365.39))).toBe(true);
		expect(months.at(-1)?.paymentCents).toBeLessThanOrEqual(toCents(365.39));
		expect(toCents(outcome?.interest ?? 0)).toBe(months.reduce((total, month) => total + month.interestCents, 0));
	});

	it('pays off sooner and with less interest when more goes toward it', () => {
		const planned = projectOne(debt('loan', 18200.36, 5.42), 365.39);
		const more = projectOne(debt('loan', 18200.36, 5.42), 565.39);

		expect((more?.finishMonth ?? '') < (planned?.finishMonth ?? '')).toBe(true);
		expect(more?.interest ?? 0).toBeLessThan(planned?.interest ?? 0);
	});

	it("is never paid off when the payment doesn't cover the month's interest", () => {
		expect(projectOne(debt('loan', 10000, 24), 200)).toEqual({ finishMonth: null, interest: null, path: [10000] });
	});
});

describe('rolling money over once a goal is done', () => {
	it("moves a paid-off debt's whole payment to the goal it rolls to, from the next month", () => {
		const goals = [debt('card', 600, 0), debt('loan', 3000, 0)];

		const outcomes = projector.project(
			goals,
			funding([
				['card', 300, 'loan'],
				['loan', 100]
			])
		);

		// The card is paid off after two months; the loan then gets $400 a month: $200 paid by then, $2,800 left takes 7 more.
		expect(outcomes.get('card')?.finishMonth).toBe('2026-12');
		expect(outcomes.get('loan')?.path.slice(0, 4)).toEqual([3000, 2900, 2800, 2400]);
		expect(outcomes.get('loan')?.finishMonth).toBe('2027-07');
	});

	it("passes money through a goal that's already done to the next one down its rollover", () => {
		const goals = [debt('card', 300, 0), saving('reached', 5000, 5000), saving('vacation', 0, 1000)];

		const outcomes = projector.project(
			goals,
			funding([
				['card', 300, 'reached'],
				['reached', 0, 'vacation'],
				['vacation', 0]
			])
		);

		expect(outcomes.get('vacation')?.path.slice(0, 4)).toEqual([0, 0, 300, 600]);
	});

	// Invariant: in a month, no goal gets more than its own money plus what's been rolled to it.
	it('keeps money that rolls nowhere, or round in a circle, out of every other goal', () => {
		const goals = [debt('first', 100, 0), debt('second', 1000, 0), saving('other', 0, 10000)];

		const outcomes = projector.project(
			goals,
			funding([
				['first', 100, 'second'],
				['second', 100, 'first'],
				['other', 50]
			])
		);

		expect(outcomes.get('second')?.path.slice(0, 3)).toEqual([1000, 900, 700]);
		expect(outcomes.get('other')?.path.slice(0, 3)).toEqual([0, 50, 100]);
	});
});
