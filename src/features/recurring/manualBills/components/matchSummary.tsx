import type { Transaction } from '../../../../monarch/api/models/transaction';
import { CheckCircleFilledIcon } from '../../../../monarch/ui/components/icons';
import { Tooltip } from '../../../../monarch/ui/components/tooltip';
import type { RecurringItemDraft } from '../../recurringItems/models/recurringItemDraft';
import type { RecurringItemServices } from '../../recurringItems/services/recurringItemServices';

const MONTHS_BEFORE = 6;
const MONTHS_SHOWN = 12;
const CHART_WIDTH = 190;
const CHART_HEIGHT = 36;
const STUB_HEIGHT = 2;
const MIN_BAR_HEIGHT = 6;
const BAR_CLASS_NAMES: Record<ChartBarKind, string> = { matched: 'bg-chart-event-border-gray', expected: 'bg-chart-fill-orange', projected: '', stub: 'bg-chart-axis' };
const PROJECTED_FILL =
	'repeating-linear-gradient(45deg, var(--color-chart-event-background-orange) 0px, var(--color-chart-event-background-orange) 2px, var(--color-chart-event-border-orange) 2px, var(--color-chart-event-border-orange) 4px)';

type ChartBarKind = 'matched' | 'expected' | 'projected' | 'stub';

interface ChartBar {
	month: string;
	kind: ChartBarKind;
	amount: number;
	anchorDate: string;
}

export interface MatchSummaryProps {
	draft: RecurringItemDraft;
	pickedTransactions: Transaction[];
	services: RecurringItemServices;
}

interface DetectionChartProps {
	bars: ChartBar[];
	services: RecurringItemServices;
}

/** Card shown above the picker once payments are picked: the detected schedule and a one-year chart of past and expected payments. */
export function MatchSummary({ draft, pickedTransactions, services }: MatchSummaryProps) {
	const { calendar, formatter, recurrence: recurrenceCalculator } = services;
	const { item, schedule } = draft;
	const recurrence = recurrenceCalculator.toRecurrence(schedule);
	const today = calendar.today();
	const currentMonth = calendar.currentMonth();
	const nextExpectedDate = recurrenceCalculator.upcomingDue(recurrence, today) ?? today;

	let timing: string;
	if (schedule.twiceMonthlyDays) timing = `on the ${formatter.ordinal(schedule.twiceMonthlyDays[0])} and ${formatter.ordinal(schedule.twiceMonthlyDays[1])}`;
	else if (schedule.unit === 'week') timing = `on ${formatter.weekday(nextExpectedDate)}s`;
	else timing = `around the ${formatter.ordinal(schedule.monthDay ?? calendar.dayOf(nextExpectedDate))}`;

	const bars = Array.from({ length: MONTHS_SHOWN }, (_, monthIndex): ChartBar => {
		const month = calendar.addMonths(currentMonth, monthIndex - MONTHS_BEFORE);
		const monthPayments = pickedTransactions.filter(transaction => transaction.date.startsWith(month));
		if (monthPayments.length) {
			const amount = monthPayments.reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
			const anchorDate =
				monthPayments
					.map(transaction => transaction.date)
					.sort()
					.at(-1) ?? `${month}-01`;
			return { month, kind: 'matched', amount, anchorDate };
		}
		const dueDate = month >= currentMonth ? recurrenceCalculator.dueDates(recurrence, month === currentMonth ? today : `${month}-01`, calendar.lastOfMonth(month))[0] : undefined;
		return dueDate ? { month, kind: 'projected', amount: item.amount, anchorDate: dueDate } : { month, kind: 'stub', amount: 0, anchorDate: `${month}-01` };
	});
	const firstProjectedBar = bars.find(bar => bar.kind === 'projected');
	if (firstProjectedBar) firstProjectedBar.kind = 'expected';

	return (
		<div
			role="region"
			aria-label="Match found"
			className="absolute inset-x-sm bottom-sm z-docked flex items-center gap-md rounded-md border border-border-primary bg-background-primary p-md shadow-lg"
		>
			<CheckCircleFilledIcon />
			<div className="flex min-w-0 flex-1 flex-col gap-2xs">
				<span data-mds="text" className="text-xs font-medium text-content-success block leading-snug">
					Match found
				</span>
				<span data-mds="text" className="text-sm font-medium text-content-primary block leading-snug text-pretty">
					{`${recurrenceCalculator.describe(schedule)} · ${formatter.money(item.amount)} · ${timing} · next expected ${formatter.longDate(nextExpectedDate)}`}
				</span>
			</div>
			<DetectionChart bars={bars} services={services} />
		</div>
	);
}

const BAR_WORDS = { matched: 'paid', expected: 'next expected', projected: 'expected' } as const;

function DetectionChart({ bars, services }: DetectionChartProps) {
	const { formatter } = services;
	const maxAmount = Math.max(...bars.map(bar => bar.amount), 1);
	const monthLabel = (bar: ChartBar | undefined) => (bar ? formatter.monthYear(`${bar.month}-01`) : '');
	const barLabel = (bar: ChartBar) => (bar.kind === 'stub' ? `${monthLabel(bar)} · no payment` : `${formatter.longDate(bar.anchorDate)} · ${formatter.money(bar.amount)} · ${BAR_WORDS[bar.kind]}`);

	return (
		<div className="shrink-0" style={{ width: CHART_WIDTH }} onClick={event => event.stopPropagation()}>
			<div className="flex items-end" style={{ height: CHART_HEIGHT, gap: 3 }}>
				{bars.map(bar => (
					<Tooltip key={bar.month} label={barLabel(bar)} delay={0}>
						<div
							className={`min-w-0 flex-1 cursor-default rounded-none ${BAR_CLASS_NAMES[bar.kind]}`}
							style={{
								height: bar.kind === 'stub' ? STUB_HEIGHT : Math.max(Math.round((bar.amount / maxAmount) * CHART_HEIGHT), MIN_BAR_HEIGHT),
								backgroundImage: bar.kind === 'projected' ? PROJECTED_FILL : undefined
							}}
						/>
					</Tooltip>
				))}
			</div>
			<div className="mt-2xs flex justify-between text-2xs leading-none text-content-secondary">
				<span>{monthLabel(bars[0])}</span>
				<span>{monthLabel(bars.at(-1))}</span>
			</div>
		</div>
	);
}
