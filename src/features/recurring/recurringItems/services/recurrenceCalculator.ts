import { type Calendar, LAST_DAY_OF_MONTH } from '../../../../common/calendar';
import { lowerMedian, median } from '../../../../common/statistics';
import type { Recurrence } from '../models/recurringItem';
import { CUSTOM_PRESET_KEY, SCHEDULE_PRESETS, type Schedule, type ScheduleUnit } from '../models/schedule';

const LOOKAHEAD_DAYS = 800;
const MAX_CACHED_RULES = 200;
const CLUSTER_SPREAD_DAYS = 4;
const DEFAULT_GAP_DAYS = 30;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const FREQUENCY_BY_UNIT: Record<ScheduleUnit, string> = { week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' };
/** The longest a period of each unit runs. */
const PERIOD_DAYS: Record<ScheduleUnit, number> = { week: DAYS_PER_WEEK, month: 31, year: 366 };

/** A recurrence as Wingspan reads it: what repeats, how often, from when, and on which days of the month. */
interface RecurrenceRule {
	unit: ScheduleUnit;
	every: number;
	start: string;
	/** The days a monthly rule falls on; a day past the end of the month is clamped to its last day. */
	monthDays: number[];
	/** At most this many dates from the start, when set. */
	count: number | null;
}

/**
 * Due dates from recurrences saved as iCalendar rules, for the part of RFC 5545 Wingspan writes. Unlike the standard, a
 * day the month doesn't have is clamped to its last day, and dates before the start are generated too, for history.
 */
export class RecurrenceCalculator {
	private readonly rulesByRecurrence = new Map<Recurrence, RecurrenceRule>();

	public constructor(private readonly calendar: Calendar) {}

	/** Monthly on `monthDay`, starting that day this month. */
	public monthly(monthDay: number): Schedule {
		return { every: 1, unit: 'month', start: this.calendar.dayInMonth(this.calendar.currentMonth(), monthDay), monthDay };
	}

	/** Writes a schedule as an iCalendar rule. An interval below 1 becomes 1. */
	public toRecurrence(schedule: Schedule): Recurrence {
		const every = Math.max(1, Math.floor(schedule.every));
		const monthDays = schedule.unit === 'month' ? `;BYMONTHDAY=${(schedule.twiceMonthlyDays ?? [schedule.monthDay ?? this.calendar.dayOf(schedule.start)]).join(',')}` : '';
		return `DTSTART:${schedule.start.replaceAll('-', '')}T000000Z\nRRULE:FREQ=${FREQUENCY_BY_UNIT[schedule.unit]};INTERVAL=${every}${monthDays}`;
	}

	/** Reads a rule back as the editor's schedule; only a monthly one gets its days. */
	public fromRecurrence(recurrence: Recurrence): Schedule {
		const { unit, every, start, monthDays } = this.ruleOf(recurrence);
		if (unit !== 'month') return { every, unit, start };
		const [firstDay, secondDay] = monthDays as [number, number | undefined];
		return secondDay === undefined ? { every, unit, start, monthDay: firstDay } : { every, unit, start, twiceMonthlyDays: [firstDay, secondDay] };
	}

	/** A schedule that starts in the future has no dates between today and its start, but still has its history before today. */
	public dueDates(recurrence: Recurrence, fromDate: string, toDate: string): string[] {
		if (fromDate > toDate) return [];
		const rule = this.ruleOf(recurrence);
		const today = this.calendar.today();
		const dates =
			rule.count === null
				? this.datesOf(rule, fromDate, toDate)
				: this.datesOf(rule, rule.start, toDate)
						.slice(0, rule.count)
						.filter(date => date >= fromDate);
		return rule.start > today ? dates.filter(date => date <= today || date >= rule.start) : dates;
	}

	/** How often a schedule is due, whatever its day or start: "month/1", "week/2", "month/1/twice". */
	public cadenceOf(recurrence: Recurrence): string {
		const schedule = this.fromRecurrence(recurrence);
		return `${schedule.unit}/${schedule.every}${schedule.twiceMonthlyDays ? '/twice' : ''}`;
	}

	/** The rule's DTSTART as an ISO date, or today when it has none. */
	public startOf(recurrence: Recurrence): string {
		return this.ruleOf(recurrence).start;
	}

	/** The previous due date, searching back up to two periods. */
	public previousDue(recurrence: Recurrence, beforeDate: string): string | null {
		const { unit, every } = this.ruleOf(recurrence);
		const lookbackDays = 2 * every * PERIOD_DAYS[unit];
		return this.dueDates(recurrence, this.calendar.addDays(beforeDate, -lookbackDays), this.calendar.addDays(beforeDate, -1)).at(-1) ?? null;
	}

	/** The first due date after `afterDate`, or null once the schedule has run out. */
	public nextDue(recurrence: Recurrence, afterDate: string): string | null {
		return this.upcomingDue(recurrence, this.calendar.addDays(afterDate, 1));
	}

	/** Searches ahead at least two periods so a schedule due every few years is still found. */
	public upcomingDue(recurrence: Recurrence, fromDate: string): string | null {
		const { unit, every } = this.ruleOf(recurrence);
		const lookaheadDays = Math.max(LOOKAHEAD_DAYS, 2 * every * PERIOD_DAYS[unit]);
		return this.dueDates(recurrence, fromDate, this.calendar.addDays(fromDate, lookaheadDays))[0] ?? null;
	}

	/** Null once a schedule with a count has run out. */
	public nextDueAfterToday(recurrence: Recurrence): string | null {
		return this.upcomingDue(recurrence, this.calendar.addDays(this.calendar.today(), 1));
	}

	/** How a schedule reads to the household: "Monthly", "Biweekly", "Every 4 months". */
	public describe(schedule: Schedule): string {
		if (schedule.twiceMonthlyDays) return 'Twice a month';
		if (schedule.every === 1) return { week: 'Weekly', month: 'Monthly', year: 'Yearly' }[schedule.unit];
		if (schedule.unit === 'week' && schedule.every === 2) return 'Biweekly';
		if (schedule.unit === 'month' && schedule.every === 3) return 'Quarterly';
		return `Every ${schedule.every} ${schedule.unit}s`;
	}

	/** The Frequency choice that matches, or the custom key when none does. */
	public presetOf(schedule: Schedule): string {
		if (schedule.twiceMonthlyDays) return 'twice';
		return SCHEDULE_PRESETS.find(preset => !preset.twiceMonthly && preset.every === schedule.every && preset.unit === schedule.unit)?.key ?? CUSTOM_PRESET_KEY;
	}

	/** Once a month on one day, so it can be shown as a due day. */
	public isPlainMonthly(schedule: Schedule): boolean {
		return schedule.unit === 'month' && schedule.every === 1 && !schedule.twiceMonthlyDays;
	}

	/** Infers a schedule from payment dates using the typical gap between them, starting from the latest. Null without dates. */
	public infer(paymentDates: string[]): Schedule | null {
		const sortedDates = [...new Set(paymentDates)].sort();
		const lastDate = sortedDates.at(-1);
		if (!lastDate) return null;

		const gaps = sortedDates.slice(1).map((paymentDate, index) => this.calendar.daysBetween(sortedDates[index] as string, paymentDate));
		const typicalGap = gaps.length ? median(gaps) : DEFAULT_GAP_DAYS;
		const daysOfMonth = sortedDates.map(paymentDate => this.calendar.dayOf(paymentDate));
		const monthly = (every: number): Schedule => ({ every, unit: 'month', start: lastDate, monthDay: lowerMedian(daysOfMonth) });

		if (typicalGap <= 10) return { every: 1, unit: 'week', start: lastDate };
		if (typicalGap <= 17) return this.twiceMonthlyFrom(daysOfMonth, lastDate) ?? { every: 2, unit: 'week', start: lastDate };
		if (typicalGap <= 45) return monthly(1);
		if (typicalGap <= 75) return monthly(2);
		if (typicalGap <= 120) return monthly(3);
		if (typicalGap <= 240) return monthly(6);
		if (typicalGap <= 500) return { every: 1, unit: 'year', start: lastDate };
		return { every: 2, unit: 'year', start: lastDate };
	}

	/** Two tight clusters of days (the 1st and 15th) mean twice a month rather than every two weeks. */
	private twiceMonthlyFrom(daysOfMonth: number[], lastDate: string): Schedule | null {
		const sortedDays = [...daysOfMonth].sort((a, b) => a - b);
		let splitIndex = 0;
		let widestGap = 0;
		for (let index = 1; index < sortedDays.length; index++) {
			const gap = (sortedDays[index] as number) - (sortedDays[index - 1] as number);
			if (gap > widestGap) {
				widestGap = gap;
				splitIndex = index;
			}
		}

		const earlyDays = sortedDays.slice(0, splitIndex);
		const lateDays = sortedDays.slice(splitIndex);
		const spread = (days: number[]) => Math.max(...days) - Math.min(...days);
		if (!earlyDays.length || !lateDays.length || spread(earlyDays) > CLUSTER_SPREAD_DAYS || spread(lateDays) > CLUSTER_SPREAD_DAYS) return null;

		return { every: 1, unit: 'month', start: lastDate, twiceMonthlyDays: [lowerMedian(earlyDays), lowerMedian(lateDays)] };
	}

	private datesOf(rule: RecurrenceRule, fromDate: string, toDate: string): string[] {
		return rule.unit === 'week' ? this.weeklyDates(rule, fromDate, toDate) : this.monthlyDates(rule, fromDate, toDate);
	}

	private weeklyDates({ start, every }: RecurrenceRule, fromDate: string, toDate: string): string[] {
		const stepDays = DAYS_PER_WEEK * every;
		const dates: string[] = [];
		for (let date = this.calendar.addDays(start, Math.ceil(this.calendar.daysBetween(start, fromDate) / stepDays) * stepDays); date <= toDate; date = this.calendar.addDays(date, stepDays)) {
			dates.push(date);
		}
		return dates;
	}

	/** Monthly, or yearly in the start's month. Each month uses the rule's days, and the interval stays aligned with the start. */
	private monthlyDates({ unit, every, start, monthDays }: RecurrenceRule, fromDate: string, toDate: string): string[] {
		const stepMonths = unit === 'year' ? MONTHS_PER_YEAR * every : every;
		const days = unit === 'year' ? [this.calendar.dayOf(start)] : monthDays;
		const startMonth = this.calendar.monthOf(start);
		const lastMonth = this.calendar.monthOf(toDate);
		const dates: string[] = [];
		for (
			let month = this.calendar.addMonths(startMonth, Math.floor(this.calendar.monthsBetween(startMonth, this.calendar.monthOf(fromDate)) / stepMonths) * stepMonths);
			month <= lastMonth;
			month = this.calendar.addMonths(month, stepMonths)
		) {
			const monthDates = [...new Set(days.map(day => this.calendar.dayInMonth(month, day)))].sort();
			dates.push(...monthDates.filter(date => date >= fromDate && date <= toDate));
		}
		return dates;
	}

	private ruleOf(recurrence: Recurrence): RecurrenceRule {
		let rule = this.rulesByRecurrence.get(recurrence);
		if (!rule) {
			if (this.rulesByRecurrence.size >= MAX_CACHED_RULES) this.rulesByRecurrence.clear();
			rule = this.parse(recurrence);
			this.rulesByRecurrence.set(recurrence, rule);
		}
		return rule;
	}

	/**
	 * Reads DTSTART and the RRULE's FREQ, INTERVAL, BYMONTHDAY, BYSETPOS and COUNT. BYMONTHDAY=-1 is the last day, and
	 * BYMONTHDAY=28,29,30;BYSETPOS=-1 is the 30th or the month's last day; with BYSETPOS=1,-1 the first day is included too.
	 */
	private parse(recurrence: Recurrence): RecurrenceRule {
		const lines = recurrence.split(/\r?\n/);
		const startDigits = /^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/i.exec(lines.find(line => /^DTSTART/i.test(line)) ?? '');
		const start = startDigits ? `${startDigits[1]}-${startDigits[2]}-${startDigits[3]}` : this.calendar.today();
		const ruleLine = (lines.find(line => line.toUpperCase().includes('FREQ=')) ?? '').toUpperCase().replace(/^RRULE:/, '');
		const parts = new Map(ruleLine.split(';').map(part => part.split('=') as [string, string]));
		const numbersOf = (name: string) =>
			(parts.get(name)?.split(',') ?? [])
				.filter(part => part.trim() !== '')
				.map(Number)
				.filter(Number.isFinite);

		let unit: ScheduleUnit = 'month';
		if (parts.get('FREQ') === 'WEEKLY') unit = 'week';
		else if (parts.get('FREQ') === 'YEARLY') unit = 'year';
		const every = Math.max(1, Math.floor(numbersOf('INTERVAL')[0] ?? 1));
		const count = numbersOf('COUNT')[0] ?? null;
		// Invalid days like 0 are skipped instead of breaking every date.
		const days = numbersOf('BYMONTHDAY')
			.filter(day => day !== 0 && day >= -1 && day <= LAST_DAY_OF_MONTH)
			.map(day => (day < 0 ? LAST_DAY_OF_MONTH : Math.floor(day)));
		if (!days.length) return { unit, every, start, monthDays: [this.calendar.dayOf(start)], count };

		const [firstDay, lastDay] = [Math.min(...days), Math.max(...days)];
		const setPositions = numbersOf('BYSETPOS');
		const isTwiceMonthly = setPositions.includes(1) || (setPositions.length === 0 && new Set(days).size === 2);
		return { unit, every, start, monthDays: isTwiceMonthly ? [firstDay, lastDay] : [lastDay], count };
	}
}
