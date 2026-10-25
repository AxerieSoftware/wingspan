import { CENT_TOLERANCE, roundToCents } from '../../../../common/money';
import { Button } from '../../../../monarch/ui/components/button';
import { CloseIcon } from '../../../../monarch/ui/components/icons';
import { MoneyInput } from '../../../../monarch/ui/components/input';
import { Select } from '../../../../monarch/ui/components/select';
import { SkeletonText } from '../../../../monarch/ui/components/skeleton';
import { TooltipButton } from '../../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { iconButtonStyles, LINK_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import { type ExtraMonths, type GoalRoom, roomLeft } from '../models/goalRoom';
import { type GoalOutcome, isByTarget, type PlannedGoal } from '../models/plannedGoal';
import { MAX_YEARS } from '../services/goalProjector';
import { GoalPathChart, GoalSparkline, goalColorOf } from './goalPathChart';

const TITLE = 'Goal planner';
/** Goal, now, extra a month, when done, finishes and its mini chart. Monarch's stylesheet has no class for these columns. */
const ROW_COLUMNS = { gridTemplateColumns: 'minmax(0, 1.3fr) 5.5rem 8rem 10rem minmax(0, 1fr) 4.5rem' };
const NOWHERE = '';

/** One goal in the plan: where it ends up at today's monthly amount and with the extra tried on top. */
export interface PlannerRow {
	goal: PlannedGoal;
	/** Added to what goes toward it each month now; negative to move money to another goal. */
	extra: number;
	/** The goal its money moves to once it's done, or null to stop. */
	rollsTo: string | null;
	now: GoalOutcome;
	plan: GoalOutcome;
	/** For a savings goal that misses a target date ahead, the least a month in all that reaches it by then. */
	neededMonthly: number | null;
	/** For a debt with a minimum payment, where it ends up paying only that. */
	atMinimum: GoalOutcome | null;
}

/** The row for income that isn't one of the projection's, like a new job. */
export const OTHER_INCOME = 'Other income';

/** An income and the change a month tried for it. `monthly` is null for other income, which has nothing yet. */
export interface IncomeRow {
	name: string;
	monthly: number | null;
	change: number;
}

export type GoalPlannerState =
	| { status: 'loading' }
	| { status: 'failed'; onRetry(): void }
	| { status: 'ready'; rows: PlannerRow[]; room: GoalRoom; incomes: IncomeRow[]; selectedId: string | null; startMonth: string };

/** Where saving the savings goals' new amounts to Monarch stands. */
export type SaveStatus = { status: 'idle' } | { status: 'saving' } | { status: 'saved'; count: number } | { status: 'failed'; message: string };

export interface GoalPlannerCardProps {
	state: GoalPlannerState;
	saveStatus: SaveStatus;
	formatter: Formatter;
	onChangeExtra(goalId: string, extra: number): void;
	onChangeRollsTo(goalId: string, targetId: string | null): void;
	onSelect(goalId: string): void;
	onChangeIncome(name: string, change: number): void;
	onReset(): void;
	onSave(): void;
}

/**
 * Try putting more or less toward savings goals and debts each month, and see when each finishes against how much room
 * there is. The new amounts can be saved to Monarch.
 */
export function GoalPlannerCard({ state, saveStatus, formatter, onChangeExtra, onChangeRollsTo, onSelect, onChangeIncome, onReset, onSave }: GoalPlannerCardProps) {
	const room = state.status === 'ready' ? state.room : null;
	const rows = state.status === 'ready' ? state.rows : [];
	const change = rows.reduce((total, row) => total + row.extra, 0);
	const hasExtras = rows.some(row => row.extra !== 0);

	return (
		<section
			role="group"
			data-mds="card"
			aria-label={TITLE}
			className="z-0 flex flex-col overflow-hidden rounded-lg border border-border-primary bg-background-primary text-content-primary shadow-none"
		>
			<div className="flex flex-wrap items-center justify-between gap-xs border-b border-b-divider-primary px-lg py-sm">
				<div className="flex items-center gap-2xs">
					<span data-mds="text" className="text-lg font-medium text-content-primary">
						{TITLE}
					</span>
					<WingspanMark />
				</div>
			</div>
			{state.status === 'ready' && (state.room.surplus !== null || state.room.budgetLeft !== null) ? (
				<RoomBand room={state.room} change={change} incomes={state.incomes} formatter={formatter} onChangeIncome={onChangeIncome} />
			) : null}
			<PlannerBody state={state} formatter={formatter} onChangeExtra={onChangeExtra} onChangeRollsTo={onChangeRollsTo} onSelect={onSelect} />
			{state.status === 'ready' && rows.length ? (
				<div className="flex flex-wrap items-center justify-between gap-sm border-t border-t-divider-primary px-lg py-sm">
					<span aria-live="polite" className={`text-sm ${saveStatus.status === 'failed' ? 'text-content-warning' : 'text-content-secondary'}`}>
						{footerNoteOf(change, saveStatus)}
					</span>
					<div className="flex items-center gap-xs">
						<Button disabled={!hasExtras && !room?.extraIncome} onClick={onReset}>
							Reset
						</Button>
						<Button variant="primary" disabled={!hasExtras} loading={saveStatus.status === 'saving'} onClick={onSave}>
							Save to goals
						</Button>
					</div>
				</div>
			) : null}
		</section>
	);
}

interface RoomBandProps {
	room: GoalRoom;
	/** The extras tried, added up, a month. */
	change: number;
	incomes: IncomeRow[];
	formatter: Formatter;
	onChangeIncome(name: string, change: number): void;
}

/**
 * The room for goals both ways and what the extras tried leave of it, then each income and the change tried for it,
 * lined up with the goals below.
 */
function RoomBand({ room, change, incomes, formatter, onChangeIncome }: RoomBandProps) {
	const { typical, budget } = roomLeft(room, 0);
	const left = hasChange(change) ? roomLeft(room, change) : null;
	const savings = `${formatter.wholeMoney(room.plannedForSavings)} planned for savings goals from your take-home pay`;
	const debts = room.plannedForDebts >= 1 ? ` and ${formatter.wholeMoney(room.plannedForDebts)} planned for debts beyond their bills` : '';
	const extra = room.extraIncome ? `, plus ${formatter.wholeMoney(room.extraIncome)} more income` : '';
	return (
		<div className="flex flex-col border-b border-b-divider-primary">
			<div className="flex flex-wrap items-start px-lg py-sm" style={{ columnGap: '2rem', rowGap: '0.5rem' }} aria-live="polite">
				{typical !== null && room.surplus !== null ? (
					<RoomStat
						label="Room by typical spending"
						amount={typical}
						left={left?.typical ?? null}
						extraMonths={room.surplusExtraMonths}
						info={`Your surplus in a normal month of ${formatter.wholeMoney(room.surplus)} at your usual spending, from Wingspan's projected balances, less ${savings}${debts}${extra}.`}
						formatter={formatter}
					/>
				) : null}
				{budget !== null && room.budgetLeft !== null ? (
					<RoomStat
						label="Room by your budget"
						amount={budget}
						left={left?.budget ?? null}
						extraMonths={room.budgetExtraMonths}
						info={`Your budgeted income less budgeted expenses in a normal month of the next year, ${formatter.wholeMoney(room.budgetLeft)}, less ${savings}${extra}. Budget extra debt payments as an expense so they count here.`}
						formatter={formatter}
					/>
				) : null}
				{left ? (
					<div role="status" className="flex flex-col">
						<span className="text-lg font-medium text-content-primary">{formatter.wholeMoney(Math.abs(change))} a month</span>
						<span className="text-xs text-content-secondary">{change > 0 ? 'Extra toward goals' : 'Less toward goals'}</span>
					</div>
				) : null}
			</div>
			<div className="grid gap-x-default px-lg pb-2xs text-xs font-medium text-content-secondary" style={ROW_COLUMNS}>
				<span>Income</span>
				<span>Now</span>
				<span>Change a month</span>
			</div>
			<ul className="m-0 flex list-none flex-col p-0 pb-xs" aria-label="Income">
				{incomes.map(income => (
					<li key={income.name} className="grid items-center gap-x-default px-lg py-2xs" style={ROW_COLUMNS}>
						<span className="truncate text-base font-book text-content-primary">{income.name}</span>
						<span className="text-base font-book text-content-secondary">{income.monthly === null ? '—' : formatter.wholeMoney(income.monthly)}</span>
						<MoneyInput
							value={income.change || null}
							allowsNegative
							size="sm"
							placeholder="+$0.00"
							label={`${income.name}, change a month`}
							formatter={formatter}
							onChange={amount => onChangeIncome(income.name, amount ?? 0)}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

interface RoomStatProps {
	label: string;
	amount: number;
	left: number | null;
	extraMonths: ExtraMonths | null;
	info: string;
	formatter: Formatter;
}

/** A room for goals in a normal month, what's left of it after the extras tried, and what months with more add. */
function RoomStat({ label, amount, left, extraMonths, info, formatter }: RoomStatProps) {
	return (
		<TooltipButton label={info} className="cursor-help flex-col items-start text-left" isLabelledByContent>
			<span className={`text-lg font-medium ${amount < 0 ? 'text-content-warning' : 'text-content-primary'}`}>{formatter.wholeMoney(amount)} a month</span>
			<span className="text-xs text-content-secondary">{label}</span>
			{left === null ? null : (
				<span className={`text-sm font-medium ${left < 0 ? 'text-content-warning' : 'text-content-success'}`}>
					{left < 0 ? `${formatter.wholeMoney(-left)} over` : `${formatter.wholeMoney(left)} left`} after extras
				</span>
			)}
			{extraMonths && extraMonths.eachAbout >= 1 ? (
				<span className="text-xs text-content-secondary">
					Plus about {formatter.wholeMoney(extraMonths.eachAbout)} more in {extraMonths.count === 1 ? 'a month' : `each of ${extraMonths.count} months`} with an extra paycheck
				</span>
			) : null}
		</TooltipButton>
	);
}

type PlannerBodyProps = Pick<GoalPlannerCardProps, 'state' | 'formatter' | 'onChangeExtra' | 'onChangeRollsTo' | 'onSelect'>;

function PlannerBody({ state, formatter, onChangeExtra, onChangeRollsTo, onSelect }: PlannerBodyProps) {
	if (state.status === 'loading') {
		return (
			<div className="flex flex-col gap-sm px-lg py-default" aria-busy="true">
				<SkeletonText className="text-base" style={{ width: '60%' }} />
				<SkeletonText className="text-base" style={{ width: '45%' }} />
			</div>
		);
	}
	if (state.status === 'failed') {
		return (
			<div className="flex flex-wrap items-center gap-md px-lg py-default" role="status">
				<span className="text-sm text-content-secondary">Couldn't load your goals and debts from Monarch.</span>
				<Button onClick={state.onRetry}>Try again</Button>
			</div>
		);
	}
	if (!state.rows.length) {
		return (
			<p className="m-0 px-lg py-default text-sm text-content-secondary">Add a savings goal with a target amount, or give a debt an interest rate and monthly payment in Monarch, to plan it here.</p>
		);
	}

	const colored = state.rows.map((row, index) => ({ ...row, color: goalColorOf(index) }));
	// A goal already at its target has nothing left to chart.
	const chartable = colored.filter(({ goal }) => goal.kind === 'debt' || goal.balance < goal.target);
	const selected = chartable.find(row => row.goal.id === state.selectedId) ?? chartable[0];
	return (
		<div className="flex flex-col">
			<div className="grid gap-x-default px-lg pt-sm pb-2xs text-xs font-medium text-content-secondary" style={ROW_COLUMNS}>
				<span>Goal</span>
				<span>Now</span>
				<span>Extra a month</span>
				<span>When done</span>
				<span>Finishes</span>
			</div>
			<ul className="m-0 flex list-none flex-col p-0" aria-label="Goals and debts">
				{colored.map(row => (
					<GoalRow
						key={row.goal.id}
						row={row}
						otherGoals={state.rows.flatMap(({ goal }) => (goal.id === row.goal.id ? [] : [goal]))}
						isSelected={row.goal.id === selected?.goal.id}
						formatter={formatter}
						onChangeExtra={onChangeExtra}
						onChangeRollsTo={onChangeRollsTo}
						onSelect={onSelect}
					/>
				))}
			</ul>
			{chartable.length ? <GoalPathChart goals={chartable} highlightedId={selected?.goal.id ?? null} startMonth={state.startMonth} formatter={formatter} /> : null}
		</div>
	);
}

interface GoalRowProps {
	row: PlannerRow & { color: string };
	isSelected: boolean;
	formatter: Formatter;
	/** Where its money can go once it's done. */
	otherGoals: PlannedGoal[];
	onChangeExtra(goalId: string, extra: number): void;
	onChangeRollsTo(goalId: string, targetId: string | null): void;
	onSelect(goalId: string): void;
}

function GoalRow({ row, otherGoals, isSelected, formatter, onChangeExtra, onChangeRollsTo, onSelect }: GoalRowProps) {
	const { goal, extra } = row;
	return (
		<li
			className={`grid items-center gap-x-default border-t border-t-divider-primary px-lg py-xs ${isSelected ? 'bg-background-secondary' : ''}`}
			style={ROW_COLUMNS}
			onFocusCapture={() => onSelect(goal.id)}
		>
			<button type="button" className="flex min-w-0 cursor-pointer flex-col border-0 bg-transparent p-0 text-left" aria-pressed={isSelected} onClick={() => onSelect(goal.id)}>
				<span className="truncate text-base font-book text-content-primary">{goal.name}</span>
				<span className="text-xs text-content-secondary">{subtitleOf(goal, formatter)}</span>
			</button>
			<div className="flex min-w-0 flex-col">
				<span className="text-base font-book text-content-secondary">{formatter.wholeMoney(goal.monthly)}</span>
				{goal.kind === 'debt' && goal.minimumPayment !== null && goal.monthly - goal.minimumPayment >= 1 ? (
					<span className="text-xs text-content-secondary">{formatter.wholeMoney(goal.monthly - goal.minimumPayment)} over minimum</span>
				) : null}
			</div>
			<div className="flex min-w-0 items-center gap-2xs">
				<div className="min-w-0 flex-1">
					<MoneyInput
						value={extra || null}
						allowsNegative
						size="sm"
						placeholder="+$0.00"
						label={`${goal.name}, extra a month`}
						formatter={formatter}
						onChange={amount => onChangeExtra(goal.id, amount ?? 0)}
					/>
				</div>
				{extra ? (
					<button
						type="button"
						className={iconButtonStyles({ variant: 'ghost', size: '3xs', className: 'shrink-0' })}
						aria-label={`Clear ${goal.name}'s extra`}
						onClick={() => onChangeExtra(goal.id, 0)}
					>
						<CloseIcon />
					</button>
				) : null}
			</div>
			<Select
				options={[[NOWHERE, 'Nowhere'], ...otherGoals.map(other => [other.id, other.name] as const)]}
				value={row.rollsTo ?? NOWHERE}
				label={`${goal.name}, when done, its money goes to`}
				onChange={targetId => onChangeRollsTo(goal.id, targetId === NOWHERE ? null : targetId)}
			/>
			<FinishCell row={row} formatter={formatter} onChangeExtra={onChangeExtra} />
			<GoalSparkline goal={goal} now={row.now} plan={row.plan} color={row.color} />
		</li>
	);
}

function subtitleOf(goal: PlannedGoal, formatter: Formatter): string {
	if (goal.kind === 'debt') return `Pay down · ${goal.interestRate}% · ${formatter.wholeMoney(goal.owed)} owed`;
	const growth = goal.growthRate ? ` · ${Number(goal.growthRate.toFixed(2))}% growth` : '';
	return goal.balance < goal.target ? `Save up · ${formatter.wholeMoney(goal.target - goal.balance)} to go${growth}` : 'Save up · target reached';
}

function FinishCell({ row, formatter, onChangeExtra }: { row: PlannerRow; formatter: Formatter; onChangeExtra(goalId: string, extra: number): void }) {
	const { goal, now, plan } = row;
	const finish = (outcome: GoalOutcome, monthly: number) => {
		if (outcome.finishMonth) return formatter.monthYear(`${outcome.finishMonth}-01`);
		if (goal.kind === 'debt') return 'Never paid off';
		return monthly > 0 ? `Over ${MAX_YEARS} years` : 'Nothing planned';
	};
	const detail = goal.kind === 'saving' ? targetNote(goal.targetDate, plan, formatter) : interestNote(row, formatter);
	const { neededMonthly } = row;

	return (
		<div className="flex min-w-0 flex-col">
			<span className="text-base font-book text-content-primary">
				{finish(plan, goal.monthly + row.extra)}
				{now.finishMonth !== plan.finishMonth ? <span className="text-sm text-content-secondary"> (was {finish(now, goal.monthly)})</span> : null}
			</span>
			{goal.kind === 'saving' && goal.targetDate && neededMonthly !== null ? (
				<button type="button" className={`${LINK_BUTTON_CLASS_NAME} text-xs`} onClick={() => onChangeExtra(goal.id, roundToCents(neededMonthly - goal.monthly))}>
					Needs {formatter.wholeMoney(neededMonthly)} a month for its {formatter.monthYear(goal.targetDate)} target
				</button>
			) : detail ? (
				<span className="text-xs text-content-secondary">{detail}</span>
			) : null}
		</div>
	);
}

function targetNote(targetDate: string | null, plan: GoalOutcome, formatter: Formatter): string | null {
	if (!targetDate) return null;
	const target = formatter.monthYear(targetDate);
	if (!plan.finishMonth) return `Target ${target}`;
	return isByTarget(plan, targetDate) ? `By its ${target} target` : `After its ${target} target`;
}

/** A debt's interest, and what it saves against paying only the minimum, or else against now. */
function interestNote({ now, plan, atMinimum }: PlannerRow, formatter: Formatter): string | null {
	if (plan.interest === null) return "Doesn't cover the interest";
	const interest = `${formatter.wholeMoney(plan.interest)} interest`;
	if (atMinimum) {
		const savedAgainstMinimum = atMinimum.interest === null ? null : atMinimum.interest - plan.interest;
		if (savedAgainstMinimum === null) return `${interest} · the minimum never pays it off`;
		if (savedAgainstMinimum >= 1) return `${interest} · ${formatter.wholeMoney(savedAgainstMinimum)} saved vs. minimum`;
	}
	const saved = now.interest !== null ? now.interest - plan.interest : 0;
	if (saved >= 1) return `${interest} · ${formatter.wholeMoney(saved)} less`;
	if (saved <= -1) return `${interest} · ${formatter.wholeMoney(-saved)} more`;
	return interest;
}

function footerNoteOf(change: number, saveStatus: SaveStatus): string {
	if (saveStatus.status === 'failed') return saveStatus.message;
	if (saveStatus.status === 'saved') return `Saved ${saveStatus.count === 1 ? 'the new monthly amount' : `${saveStatus.count} new monthly amounts`} to Monarch.`;
	return hasChange(change) ? '' : 'Add an extra amount to see when each goal finishes.';
}

function hasChange(change: number): boolean {
	return Math.abs(change) >= CENT_TOLERANCE;
}
