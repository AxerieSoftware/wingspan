import { batch, effect, signal, untracked } from '@preact/signals-core';
import type { QueryClient } from '@tanstack/query-core';
import type { Calendar } from '../../../common/calendar';
import { roundToCents } from '../../../common/money';
import type { QueryResult, SyncedQueries } from '../../../common/syncedQueries';
import type { MonarchDataService } from '../../../data/services/monarchDataService';
import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { GoalPlans } from '../../../monarch/api/models/goalPlans';
import type { MonthBudget } from '../../../monarch/api/models/monthBudget';
import { MonarchApiError } from '../../../monarch/api/monarchApiError';
import type { MonarchBudgetClient } from '../../../monarch/api/monarchBudgetClient';
import type { MonarchGoalsClient } from '../../../monarch/api/monarchGoalsClient';
import type { GoalsPage } from '../../../monarch/pages/goals/goalsPage';
import { Island } from '../../../monarch/ui/components/island';
import type { Formatter } from '../../../monarch/ui/formatter';
import type { Projection } from '../../cashFlow/projectedBalances/models/projection';
import type { ProjectedBalancesService } from '../../cashFlow/projectedBalances/services/projectedBalancesService';
import type { WingspanFeature } from '../../wingspanFeature';
import { GoalPlannerCard, type GoalPlannerState, type IncomeRow, OTHER_INCOME, type SaveStatus } from './components/goalPlannerCard';
import { budgetMonthsOf, type GoalRoom, type PlannedOutOfRoom, plannedOutOfRoom } from './models/goalRoom';
import { type IncomeMonths, type IncomeStream, incomeMonthsOf, incomeStreamsOf } from './models/incomeStream';
import { type GoalOutcome, isByTarget, type PlannedGoal } from './models/plannedGoal';
import type { GoalProjector } from './services/goalProjector';

const GOAL_PLANS_QUERY = 'monarchGoalPlans';

/** What the planner works out from the plans and rollovers alone, kept while they're the same. */
interface Baseline {
	plans: GoalPlans;
	rollsTo: Record<string, string>;
	goals: PlannedGoal[];
	nowOutcomes: Map<string, GoalOutcome>;
	atMinimumById: Map<string, GoalOutcome>;
	neededMonthlyOf(goal: PlannedGoal & { kind: 'saving' }): number | null;
}

/** The projection's incomes and its normal month, kept while the projection is the same. */
interface ProjectionIncome {
	projection: Projection;
	streams: IncomeStream[];
	months: IncomeMonths | null;
}
const MONTH_BUDGETS_QUERY = 'monarchMonthBudgets';
/** The budget's normal month is the median of the year ahead, with months bringing in an extra paycheck shown apart. */
const BUDGET_MONTHS = 12;

/**
 * The Goal planner under Monarch's Save up goals: try other monthly amounts for savings goals and debts against the
 * room in the household's monthly surplus, then save the new amounts to Monarch. When done choices are saved with
 * Wingspan's data as they're made. Income changes are kept only while the page is open.
 */
export class GoalPlannerFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	/** The extra a month tried for each goal, by goal id, on top of what goes toward it in Monarch. */
	private readonly extraMonthly = signal<ReadonlyMap<string, number>>(new Map());
	private readonly selectedId = signal<string | null>(null);
	/** The change a month tried for each income, by its name, with other income under `OTHER_INCOME`. */
	private readonly incomeChanges = signal<ReadonlyMap<string, number>>(new Map());
	private readonly saveStatus = signal<SaveStatus>({ status: 'idle' });
	private baseline: Baseline | null = null;
	private income: ProjectionIncome | null = null;
	private island: Island | null = null;
	/** What the card last rendered from, compared by reference. */
	private renderedInputs: unknown[] | null = null;

	public constructor(
		private readonly page: GoalsPage,
		private readonly goalsClient: MonarchGoalsClient,
		private readonly budgetClient: MonarchBudgetClient,
		private readonly projectedBalances: ProjectedBalancesService,
		private readonly monarchData: MonarchDataService,
		private readonly dataService: WingspanDataService,
		private readonly syncedQueries: SyncedQueries,
		private readonly queryClient: QueryClient,
		private readonly projector: GoalProjector,
		private readonly calendar: Calendar,
		private readonly formatter: Formatter
	) {}

	public start(): void {
		this.subscriptions.defer(
			effect(() => {
				void [
					this.projectedBalances.state.value,
					this.monarchData.snapshot.value,
					this.dataService.data.value,
					this.extraMonthly.value,
					this.selectedId.value,
					this.incomeChanges.value,
					this.saveStatus.value
				];
				untracked(() => this.render());
			})
		);
	}

	public sync(): void {
		if (!this.page.isActive) {
			this.page.removeSection();
			return;
		}

		// The room comes from the projection, which needs Monarch's data.
		void this.monarchData.load();
		void this.dataService.load();
		this.page.showSection({ render: hostElement => this.mount(hostElement) });
		this.render();
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.page.removeSection();
	}

	private mount(hostElement: HTMLElement): () => void {
		this.island = new Island(hostElement);
		this.renderedInputs = null;
		return () => {
			this.island?.unmount();
			this.island = null;
		};
	}

	/** Renders only when something shown changed, since every change to Monarch's page syncs. */
	private render(): void {
		if (!this.island) return;
		const firstMonth = this.calendar.currentMonth();
		const plans = this.syncedQueries.read([GOAL_PLANS_QUERY, firstMonth], () => this.goalsClient.getGoalPlans(firstMonth));
		const lastMonth = this.calendar.addMonths(firstMonth, BUDGET_MONTHS - 1);
		const budget = this.syncedQueries.read([MONTH_BUDGETS_QUERY, firstMonth, lastMonth], () => this.budgetClient.getMonthBudgets(firstMonth, lastMonth));
		const inputs = [
			plans.status === 'ready' ? plans.data : plans.status,
			budget.status === 'ready' ? budget.data : budget.status,
			this.projectedBalances.state.peek(),
			this.extraMonthly.peek(),
			this.monarchData.snapshot.peek(),
			this.dataService.data.peek(),
			this.selectedId.peek(),
			this.incomeChanges.peek(),
			this.saveStatus.peek()
		];
		if (this.renderedInputs?.every((input, index) => input === inputs[index])) return;
		this.renderedInputs = inputs;

		this.island.render(
			<GoalPlannerCard
				state={this.toPlannerState(plans, budget.status === 'ready' ? budget.data : [])}
				saveStatus={this.saveStatus.peek()}
				formatter={this.formatter}
				onSave={() => void this.saveToGoals(plans.status === 'ready' ? plans.data : null)}
				onChangeExtra={(goalId, extra) => this.tryExtra(goalId, extra)}
				onChangeRollsTo={(goalId, targetId) => void this.saveRollover(goalId, targetId)}
				onSelect={goalId => {
					this.selectedId.value = goalId;
				}}
				onChangeIncome={(name, change) => {
					this.incomeChanges.value = new Map(this.incomeChanges.peek()).set(name, change);
				}}
				onReset={() =>
					batch(() => {
						this.extraMonthly.value = new Map();
						this.incomeChanges.value = new Map();
						this.clearSaveStatus();
					})
				}
			/>
		);
	}

	private toPlannerState(plans: QueryResult<GoalPlans>, monthBudgets: MonthBudget[]): GoalPlannerState {
		if (plans.status === 'loading') return { status: 'loading' };
		if (plans.status === 'failed') return { status: 'failed', onRetry: () => void this.queryClient.resetQueries({ queryKey: [GOAL_PLANS_QUERY] }) };

		const extraMonthly = this.extraMonthly.peek();
		const baseline = this.baselineOf(plans.data);
		const fundingOf = (goal: PlannedGoal, monthly: number) => ({ monthly, rollsTo: baseline.rollsTo[goal.id] ?? null });
		const planOutcomes = this.projector.project(
			baseline.goals,
			// Taking more than goes toward a goal now leaves nothing going toward it, not a withdrawal.
			new Map(baseline.goals.map(goal => [goal.id, fundingOf(goal, Math.max(0, goal.monthly + (extraMonthly.get(goal.id) ?? 0)))]))
		);
		const rows = baseline.goals.flatMap(goal => {
			const now = baseline.nowOutcomes.get(goal.id);
			const plan = planOutcomes.get(goal.id);
			if (!now || !plan) return [];
			const missesTarget = goal.kind === 'saving' && goal.targetDate !== null && !isByTarget(plan, goal.targetDate);
			const neededMonthly = missesTarget ? baseline.neededMonthlyOf(goal) : null;
			return [{ goal, extra: extraMonthly.get(goal.id) ?? 0, rollsTo: baseline.rollsTo[goal.id] ?? null, now, plan, neededMonthly, atMinimum: baseline.atMinimumById.get(goal.id) ?? null }];
		});
		const income = this.incomeOf(this.householdProjection());
		const room = this.toRoom(plannedOutOfRoom(plans.data, this.linkedPaymentsByDebtId()), income, monthBudgets);
		return { status: 'ready', rows, room, incomes: this.toIncomeRows(income?.streams ?? []), selectedId: this.selectedId.peek(), startMonth: this.calendar.currentMonth() };
	}

	/**
	 * What the extras tried can't change, worked out again only when the plans or the rollovers do: the goals, where they
	 * end up now and paying only a debt's minimum, and, asked for only when a goal misses its target, what it needs.
	 */
	private baselineOf(plans: GoalPlans): Baseline {
		const rollsTo = this.rollsToByGoalId();
		if (this.baseline?.plans === plans && this.baseline.rollsTo === rollsTo) return this.baseline;

		// A goal without a target can't finish, so it gets no row, but what's planned for it still comes out of the room.
		const goals: PlannedGoal[] = [
			...plans.savingsGoals.flatMap(({ id, name, monthlyContribution, balance, target, targetDate, growthRate }) =>
				target === null ? [] : [{ kind: 'saving' as const, id, name, monthly: monthlyContribution, balance, target, targetDate, growthRate }]
			),
			...plans.debts.map(debt => ({
				kind: 'debt' as const,
				id: debt.id,
				name: debt.name,
				monthly: debt.monthlyPayment,
				owed: debt.owed,
				interestRate: debt.interestRate,
				minimumPayment: debt.minimumPayment
			}))
		];
		const nowOutcomes = this.projector.project(goals, new Map(goals.map(goal => [goal.id, { monthly: goal.monthly, rollsTo: rollsTo[goal.id] ?? null }])));
		// Paying only the minimum, on its own, as Monarch's own payoff dates assume.
		const atMinimumById = new Map(
			goals.flatMap(goal => {
				if (goal.kind !== 'debt' || goal.minimumPayment === null) return [];
				const outcome = this.projector.project([goal], new Map([[goal.id, { monthly: goal.minimumPayment, rollsTo: null }]])).get(goal.id);
				return outcome ? [[goal.id, outcome] as const] : [];
			})
		);
		const neededById = new Map<string, number | null>();
		const neededMonthlyOf = (goal: PlannedGoal & { kind: 'saving' }) => {
			if (!neededById.has(goal.id)) neededById.set(goal.id, goal.targetDate ? this.projector.neededMonthly(goal, this.calendar.monthOf(goal.targetDate)) : null);
			return neededById.get(goal.id) ?? null;
		};
		this.baseline = { plans, rollsTo, goals, nowOutcomes, atMinimumById, neededMonthlyOf };
		return this.baseline;
	}

	/** The projection's incomes and its normal month, worked out again only when the projection changes. */
	private incomeOf(projection: Projection | null): ProjectionIncome | null {
		if (!projection) return null;
		if (this.income?.projection === projection) return this.income;
		const today = this.calendar.today();
		const streams = incomeStreamsOf(projection.days, today);
		this.income = { projection, streams, months: incomeMonthsOf(projection.days, today, streams) };
		return this.income;
	}

	/** Both ways in a normal month, since goals are funded month by month and a third paycheck comes only some months. */
	private toRoom(planned: PlannedOutOfRoom, income: ProjectionIncome | null, monthBudgets: MonthBudget[]): GoalRoom {
		const incomeMonths = income?.months ?? null;
		const budgetMonths = budgetMonthsOf(monthBudgets);
		return {
			surplus: income ? roundToCents(income.projection.monthlySurplus - (incomeMonths?.belowAverage ?? 0)) : null,
			surplusExtraMonths: incomeMonths?.extraMonths ?? null,
			budgetLeft: budgetMonths?.left ?? null,
			budgetExtraMonths: budgetMonths?.extraMonths ?? null,
			plannedForSavings: planned.savings,
			plannedForDebts: planned.debts,
			extraIncome: [...this.incomeChanges.peek().values()].reduce((total, change) => total + change, 0)
		};
	}

	/** Each income in the projection, then other income, with the change tried for each. */
	private toIncomeRows(streams: readonly IncomeStream[]): IncomeRow[] {
		const changes = this.incomeChanges.peek();
		return [...streams.map(stream => ({ ...stream, change: changes.get(stream.name) ?? 0 })), { name: OTHER_INCOME, monthly: null, change: changes.get(OTHER_INCOME) ?? 0 }];
	}

	/** Only a projection of the household's own money counts, since the goals are the household's. */
	private householdProjection(): Projection | null {
		const state = this.projectedBalances.state.peek();
		return state.status === 'ready' && state.includesHousehold ? state.projection : null;
	}

	/** What Monarch's recurring payments linked to each loan with Pays toward add up to a month, by loan account id. */
	private linkedPaymentsByDebtId(): Map<string, number> {
		const flows = this.monarchData.snapshot.peek()?.recurringFlows ?? [];
		const linked = new Map<string, number>();
		for (const [recurrenceId, loanAccountId] of Object.entries(this.dataService.data.peek().loanPaymentLinks.loanAccountIdByRecurrenceId)) {
			const amount = flows.find(flow => flow.recurrenceGroup.id === recurrenceId)?.recurrenceGroup.amount;
			if (amount) linked.set(loanAccountId, roundToCents((linked.get(loanAccountId) ?? 0) + Math.abs(amount)));
		}
		return linked;
	}

	private rollsToByGoalId(): Record<string, string> {
		return this.dataService.data.peek().goalRollovers.rollsToByGoalId;
	}

	/** Saves where a goal's money goes once it's done, or that it goes nowhere. */
	private saveRollover(goalId: string, targetId: string | null): Promise<void> {
		return this.dataService.update(data => {
			const rollsToByGoalId = { ...data.goalRollovers.rollsToByGoalId };
			if (targetId === null) delete rollsToByGoalId[goalId];
			else rollsToByGoalId[goalId] = targetId;
			return { ...data, goalRollovers: { ...data.goalRollovers, rollsToByGoalId } };
		});
	}

	private tryExtra(goalId: string, extra: number): void {
		batch(() => {
			this.extraMonthly.value = new Map(this.extraMonthly.peek()).set(goalId, extra);
			this.selectedId.value = goalId;
			this.clearSaveStatus();
		});
	}

	/** Only when there's a status to clear, since a new idle object would render the card again. */
	private clearSaveStatus(): void {
		if (this.saveStatus.peek().status !== 'idle') this.saveStatus.value = { status: 'idle' };
	}

	/**
	 * Saves what each goal and debt with an extra would get a month in all, so a retry after a failure sets the same
	 * amounts again, then shows the saved amounts as now.
	 */
	private async saveToGoals(plans: GoalPlans | null): Promise<void> {
		if (!plans || this.saveStatus.peek().status === 'saving') return;
		const extraMonthly = this.extraMonthly.peek();
		const totalsFor = (monthlyById: [string, number][]) =>
			new Map(
				monthlyById.flatMap(([id, monthly]) => {
					const extra = extraMonthly.get(id);
					return extra ? [[id, Math.max(0, monthly + extra)] as const] : [];
				})
			);
		const goalTotals = totalsFor(plans.savingsGoals.map(goal => [goal.id, goal.monthlyContribution]));
		const debtTotals = totalsFor(plans.debts.map(debt => [debt.id, debt.monthlyPayment]));
		if (!goalTotals.size && !debtTotals.size) return;

		const month = this.calendar.currentMonth();
		this.saveStatus.value = { status: 'saving' };
		try {
			await this.goalsClient.setMonthlyAmounts(goalTotals, debtTotals, month);
			await this.queryClient.fetchQuery({ queryKey: [GOAL_PLANS_QUERY, month], queryFn: () => this.goalsClient.getGoalPlans(month), staleTime: 0, gcTime: Number.POSITIVE_INFINITY });
		} catch (error) {
			this.saveStatus.value = { status: 'failed', message: error instanceof MonarchApiError ? error.message : "Monarch didn't save the new monthly amounts." };
			return;
		}
		batch(() => {
			this.extraMonthly.value = new Map([...this.extraMonthly.peek()].filter(([id]) => !goalTotals.has(id) && !debtTotals.has(id)));
			this.saveStatus.value = { status: 'saved', count: goalTotals.size + debtTotals.size };
		});
	}
}
