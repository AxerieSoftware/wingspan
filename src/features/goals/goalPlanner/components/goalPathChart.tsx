import { type MouseEvent, useId, useRef, useState } from 'react';
import { MONTHS_PER_YEAR } from '../../../../common/money';
import { niceTicks } from '../../../../monarch/ui/chartTicks';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { useElementWidth } from '../../../../monarch/ui/hooks/useElementWidth';
import type { GoalOutcome, PlannedGoal } from '../models/plannedGoal';

const HEIGHT = 260;
const PLOT_LEFT = 56;
const Y_LABEL_X = 44;
const PLOT_TOP = 12;
const PLOT_BOTTOM_GAP = 30;
const PLOT_RIGHT_GAP = 8;
const TARGET_Y_TICKS = 5;
const TARGET_X_TICKS = 7;
/** Goals further out than this run off the chart's right edge, so one far-off goal doesn't flatten the rest. */
const MAX_MONTHS_SHOWN = 10 * MONTHS_PER_YEAR;
const SPARKLINE_WIDTH = 72;
const SPARKLINE_HEIGHT = 28;
/** Monarch's chart fills, leaving out purple for targets and gray for where the highlighted goal is headed now. */
const GOAL_COLORS = ['blue', 'orange', 'teal', 'pink', 'indigo', 'lime', 'brown', 'sky', 'yellow', 'red', 'green'].map(name => `var(--chart-fill-${name})`);
/** Like Monarch's goal Timeline: gray dashed for where a goal is headed now, its purple line for the target. */
const NOW_COLOR = 'var(--chart-label)';
const TARGET_COLOR = 'var(--content-purple)';
const DASH = '5 4';
const GROUP_DASH = '10 4';
/** What comes before it in a goal's name, like "Retirement" in "Retirement – 401(k) Andrew", groups the goal with others. */
const GROUP_SEPARATOR = /\s+[–-]\s+/;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 16;

/** A goal, where it ends up now and with the extra tried, and its line's color. */
export interface GoalPaths {
	goal: PlannedGoal;
	now: GoalOutcome;
	plan: GoalOutcome;
	color: string;
}

export interface GoalPathChartProps {
	goals: GoalPaths[];
	/** The goal drawn on top, with where it's headed now and its target. */
	highlightedId: string | null;
	/** The month the paths start in, "YYYY-MM". */
	startMonth: string;
	formatter: Formatter;
}

/** The color of the goal at this position in the list, the same in its row and on the chart. */
export function goalColorOf(index: number): string {
	return GOAL_COLORS[index % GOAL_COLORS.length] ?? NOW_COLOR;
}

/**
 * Every goal month by month with the extras tried, styled like Monarch's goal Timeline: savings climbing to their
 * targets and debts falling to $0, each in its own color. The highlighted goal also shows where it's headed now.
 */
export function GoalPathChart(props: GoalPathChartProps) {
	const highlighted = props.goals.find(paths => paths.goal.id === props.highlightedId);
	const months = Math.min(MAX_MONTHS_SHOWN, Math.max(0, ...props.goals.map(paths => monthsShown(paths, paths === highlighted))));
	if (!months) {
		return <p className="m-0 border-t border-t-divider-primary px-lg py-sm text-sm text-content-secondary">Add an extra amount to a goal to chart when it finishes.</p>;
	}
	// Its own component, so it measures its width each time it appears after the hint.
	return <GoalPathPlot {...props} highlighted={highlighted} months={months} />;
}

/** A row's small chart of its own paths, with no axes. */
export function GoalSparkline(paths: GoalPaths) {
	const months = monthsShown(paths, true);
	const topAmount = topAmountOf([paths], months, paths);
	const xOf = (month: number) => (months ? (month / months) * SPARKLINE_WIDTH : 0);
	const yOf = (amount: number) => 2 + (1 - amount / topAmount) * (SPARKLINE_HEIGHT - 4);
	return (
		<svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} aria-hidden="true" className="justify-self-end">
			<polyline points={pointsOf(paths.now, months, xOf, yOf)} fill="none" stroke={NOW_COLOR} strokeWidth={1.5} strokeDasharray="3 2" />
			<polyline points={pointsOf(paths.plan, months, xOf, yOf)} fill="none" stroke={paths.color} strokeWidth={2} />
		</svg>
	);
}

function GoalPathPlot({ goals, highlighted, months, startMonth, formatter }: GoalPathChartProps & { highlighted: GoalPaths | undefined; months: number }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(containerRef);
	const gradientId = useId().replaceAll(':', '');
	const target = highlighted?.goal.kind === 'saving' ? highlighted.goal.target : null;
	const groups = groupsOf(goals, months);
	const ticks = niceTicks(0, Math.max(topAmountOf(goals, months, highlighted), ...groups.flatMap(group => group.path)), TARGET_Y_TICKS);
	const topTick = ticks.at(-1) ?? 1;
	const plotRight = Math.max(PLOT_LEFT + 1, width - PLOT_RIGHT_GAP);
	const plotBottom = HEIGHT - PLOT_BOTTOM_GAP;
	const xOf = (month: number) => PLOT_LEFT + (month / months) * (plotRight - PLOT_LEFT);
	const yOf = (amount: number) => plotBottom - (amount / topTick) * (plotBottom - PLOT_TOP);
	const monthEvery = Math.max(1, Math.ceil(months / TARGET_X_TICKS));
	// The highlighted goal goes last, so it's drawn over the others.
	const others = goals.filter(paths => paths !== highlighted);
	const [hover, setHover] = useState<{ month: number; y: number } | null>(null);
	const monthLabelOf = (month: number) => formatter.monthYear(`${Temporal.PlainYearMonth.from(startMonth).add({ months: month }).toString()}-01`);

	const trackHover = (event: MouseEvent<SVGRectElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const month = Math.round(((event.clientX - bounds.left) / bounds.width) * months);
		setHover({ month: Math.min(months, Math.max(0, month)), y: event.clientY - bounds.top });
	};

	return (
		<div className="flex flex-col gap-xs border-t border-t-divider-primary px-lg py-sm">
			<div ref={containerRef} className="relative w-full" style={{ height: HEIGHT }}>
				{width ? (
					<svg width={width} height={HEIGHT} role="img" aria-label={labelOf(highlighted, formatter)} className="block">
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop offset={0} stopColor={highlighted?.color} stopOpacity={0.18} />
								<stop offset={1} stopColor={highlighted?.color} stopOpacity={0} />
							</linearGradient>
						</defs>
						{ticks.map(tick => (
							<g key={tick}>
								<line x1={PLOT_LEFT} x2={plotRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--chart-axis)" />
								<text x={Y_LABEL_X} y={yOf(tick)} dy="0.355em" textAnchor="end" fontSize={12} fontWeight={500} fill="var(--chart-label)">
									{formatter.compactMoney(tick)}
								</text>
							</g>
						))}
						{groups.map(group => (
							<polyline
								key={group.name}
								points={group.path.map((amount, month) => `${xOf(month)},${yOf(amount)}`).join(' ')}
								fill="none"
								stroke={group.color}
								strokeWidth={2.5}
								strokeDasharray={GROUP_DASH}
							/>
						))}
						{others.map(paths => (
							<PlanLine key={paths.goal.id} paths={paths} months={months} xOf={xOf} yOf={yOf} strokeWidth={1.5} />
						))}
						{highlighted ? (
							<>
								<polygon points={`${xOf(0)},${plotBottom} ${pointsOf(highlighted.plan, months, xOf, yOf)} ${xOf(lastMonthOf(highlighted.plan, months))},${plotBottom}`} fill={`url(#${gradientId})`} />
								{target === null ? null : <line x1={PLOT_LEFT} x2={plotRight} y1={yOf(target)} y2={yOf(target)} stroke={TARGET_COLOR} strokeWidth={2} />}
								<polyline points={pointsOf(highlighted.now, months, xOf, yOf)} fill="none" stroke={NOW_COLOR} strokeWidth={2} strokeDasharray={DASH} />
								<PlanLine paths={highlighted} months={months} xOf={xOf} yOf={yOf} strokeWidth={3} />
							</>
						) : null}
						{Array.from({ length: months + 1 }, (_, month) => month)
							.filter(month => month % monthEvery === 0)
							.map(month => (
								// The last month sits at the plot's right edge, so it's right-aligned to stay inside the chart.
								<text key={month} x={xOf(month)} y={plotBottom + 12} dy="0.71em" textAnchor={month === months ? 'end' : 'middle'} fontSize={12} fontWeight={500} fill="var(--chart-label)">
									{monthLabelOf(month)}
								</text>
							))}
						{hover ? (
							<g pointerEvents="none">
								<line x1={xOf(hover.month)} x2={xOf(hover.month)} y1={PLOT_TOP} y2={plotBottom} stroke="var(--divider-secondary)" />
								{highlighted ? <Dot x={xOf(hover.month)} y={yOf(amountAt(highlighted.now, hover.month))} fill={NOW_COLOR} /> : null}
								{[...others, ...(highlighted ? [highlighted] : [])].map(paths => (
									<Dot key={paths.goal.id} x={xOf(hover.month)} y={yOf(amountAt(paths.plan, hover.month))} fill={paths.color} />
								))}
								{groups.flatMap(group => {
									const amount = group.path[hover.month];
									return amount === undefined ? [] : [<Dot key={group.name} x={xOf(hover.month)} y={yOf(amount)} fill={group.color} />];
								})}
							</g>
						) : null}
						<rect x={PLOT_LEFT} y={0} width={plotRight - PLOT_LEFT} height={plotBottom} fill="transparent" onMouseMove={trackHover} onMouseLeave={() => setHover(null)} />
					</svg>
				) : null}
				{hover ? (
					<MonthTooltip
						month={monthLabelOf(hover.month)}
						rows={[
							...tooltipRowsOf(goals, highlighted, hover.month),
							...groups.flatMap(group => {
								const amount = group.path[hover.month];
								return amount === undefined ? [] : [{ label: group.label, amount, color: group.color }];
							})
						]}
						{...tooltipPosition(xOf(hover.month), hover.y, width)}
						width={Math.min(TOOLTIP_WIDTH, width)}
						formatter={formatter}
					/>
				) : null}
			</div>
			<div className="flex flex-wrap items-center justify-center gap-x-md gap-y-2xs text-xs font-medium">
				{goals.map(paths => (
					<LegendItem key={paths.goal.id} color={paths.color} label={paths.goal.name} isSolid />
				))}
				{groups.map(group => (
					<LegendItem key={group.name} color={group.color} label={group.label} />
				))}
				{highlighted ? <LegendItem color={NOW_COLOR} label={`${highlighted.goal.name} now`} /> : null}
				{target === null ? null : <LegendItem color={TARGET_COLOR} label={`Target ${formatter.wholeMoney(target)}`} isSolid />}
			</div>
		</div>
	);
}

interface PlanLineProps {
	paths: GoalPaths;
	months: number;
	xOf(month: number): number;
	yOf(amount: number): number;
	strokeWidth: number;
}

/** A goal's path with the extra tried, with a dot where it finishes. */
function PlanLine({ paths, months, xOf, yOf, strokeWidth }: PlanLineProps) {
	const { plan, color } = paths;
	const finishMonth = plan.finishMonth && plan.path.length - 1 <= months ? plan.path.length - 1 : null;
	return (
		<>
			<polyline points={pointsOf(plan, months, xOf, yOf)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
			{finishMonth === null ? null : <circle cx={xOf(finishMonth)} cy={yOf(plan.path.at(-1) ?? 0)} r={strokeWidth + 1} fill={color} />}
		</>
	);
}

function Dot({ x, y, fill }: { x: number; y: number; fill: string }) {
	return <circle cx={x} cy={y} r={5} fill={fill} stroke="var(--background-primary)" strokeWidth={2} />;
}

interface TooltipRow {
	label: string;
	amount: number;
	color: string;
}

/** Each goal's amount in the hovered month, the highlighted one first with where it's headed now. */
function tooltipRowsOf(goals: GoalPaths[], highlighted: GoalPaths | undefined, month: number): TooltipRow[] {
	const rowOf = ({ goal, plan, color }: GoalPaths): TooltipRow => ({ label: goal.name, amount: amountAt(plan, month), color });
	if (!highlighted) return goals.map(rowOf);
	const nowRow = { label: `${highlighted.goal.name} without the extra`, amount: amountAt(highlighted.now, month), color: NOW_COLOR };
	return [rowOf(highlighted), nowRow, ...goals.filter(paths => paths !== highlighted).map(rowOf)];
}

/** Places the tooltip beside the hovered month instead of over it. */
function tooltipPosition(x: number, pointerY: number, width: number): { left: number; top: number } {
	const fitsRight = x + TOOLTIP_GAP + TOOLTIP_WIDTH <= width;
	return {
		left: fitsRight ? x + TOOLTIP_GAP : Math.max(0, x - TOOLTIP_GAP - TOOLTIP_WIDTH),
		top: Math.max(0, pointerY - HEIGHT / 3)
	};
}

/** Styled like Monarch's chart tooltips: the month over a dot, name and amount for each line. */
function MonthTooltip({ month, rows, left, top, width, formatter }: { month: string; rows: TooltipRow[]; left: number; top: number; width: number; formatter: Formatter }) {
	return (
		<div data-theme="dark" role="tooltip" className="pointer-events-none absolute z-tooltip" style={{ left, top, width }}>
			<div className="flex flex-col rounded-lg bg-background-primary text-content-primary shadow-lg">
				<span className="border-b border-b-divider-primary px-default py-sm text-sm font-medium">{month}</span>
				<div className="flex flex-col gap-xs px-default py-sm">
					{rows.map(row => (
						<div key={row.label} className="flex items-center gap-xs text-sm">
							<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
							<span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
							<span className="shrink-0 font-medium">{formatter.money(row.amount)}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function LegendItem({ color, label, isSolid = false }: { color: string; label: string; isSolid?: boolean }) {
	return (
		<span className="inline-flex items-center gap-2xs text-content-secondary">
			<svg width={16} height={8} aria-hidden="true">
				<line x1={0} x2={16} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={isSolid ? undefined : '4 3'} />
			</svg>
			{label}
		</span>
	);
}

function labelOf(highlighted: GoalPaths | undefined, formatter: Formatter): string {
	const all = 'Every goal and debt by month with the extras tried';
	if (!highlighted) return all;
	const { goal } = highlighted;
	const description = goal.kind === 'saving' ? `saved by month toward ${formatter.wholeMoney(goal.target)}` : `owed by month, from ${formatter.wholeMoney(goal.owed)} down to $0`;
	return `${all}. ${goal.name}: ${description}, now and with the extra tried`;
}

/** Months from now through the goal's later finish, or 0 when it never finishes. Only the highlighted goal counts where it's headed now. */
function monthsShown({ now, plan }: GoalPaths, includesNow: boolean): number {
	const finishedLengths = (includesNow ? [now, plan] : [plan]).filter(outcome => outcome.finishMonth).map(outcome => outcome.path.length);
	return finishedLengths.length ? Math.max(...finishedLengths) - 1 : 0;
}

function topAmountOf(goals: GoalPaths[], months: number, highlighted: GoalPaths | undefined): number {
	const amounts = goals.flatMap(({ goal, now, plan }) => [
		...plan.path.slice(0, months + 1),
		...(highlighted?.goal.id === goal.id ? now.path.slice(0, months + 1) : []),
		goal.kind === 'saving' ? goal.balance : goal.owed
	]);
	const target = highlighted?.goal.kind === 'saving' ? highlighted.goal.target : 0;
	return Math.max(...amounts, target) || 1;
}

/** Savings goals that share a name before " – ", added up month by month. */
interface GoalGroup {
	name: string;
	label: string;
	color: string;
	/** What's saved across the group at the end of each month, through when its last goal finishes or the chart's edge. */
	path: number[];
}

/** Savings goals grouped by the start of their names, for groups of two or more, in colors after the goals'. */
function groupsOf(goals: GoalPaths[], months: number): GoalGroup[] {
	const membersByName = Map.groupBy(
		goals.filter(paths => paths.goal.kind === 'saving' && GROUP_SEPARATOR.test(paths.goal.name)),
		paths => paths.goal.name.split(GROUP_SEPARATOR)[0] ?? ''
	);
	return [...membersByName]
		.filter(([, members]) => members.length > 1)
		.map(([name, members], index) => {
			const lastMonth = Math.max(...members.map(paths => lastMonthOf(paths.plan, months)));
			const path = Array.from({ length: lastMonth + 1 }, (_, month) => members.reduce((total, paths) => total + amountAt(paths.plan, month), 0));
			return { name, label: `${name}, all`, color: goalColorOf(goals.length + index), path };
		});
}

/** What's saved or owed in a month: today's amount for a path that never finishes, and the end amount after one finishes. */
function amountAt(outcome: GoalOutcome, month: number): number {
	return outcome.path[Math.min(month, outcome.path.length - 1)] ?? 0;
}

/** The month a path's line ends in: where it finishes, or the chart's edge. */
function lastMonthOf(outcome: GoalOutcome, months: number): number {
	return outcome.finishMonth ? Math.min(months, outcome.path.length - 1) : months;
}

/** A path that never finishes stays where the goal is today across the chart. One that runs past the chart is cut at its edge. */
function pointsOf(outcome: GoalOutcome, months: number, xOf: (month: number) => number, yOf: (amount: number) => number): string {
	const path = outcome.finishMonth ? outcome.path.slice(0, months + 1) : Array.from({ length: months + 1 }, () => outcome.path[0] ?? 0);
	return path.map((amount, month) => `${xOf(month)},${yOf(amount)}`).join(' ');
}
