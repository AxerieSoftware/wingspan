import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import type { Schedule } from '../models/schedule';
import { RecurrenceCalculator } from './recurrenceCalculator';

const recurrence = new RecurrenceCalculator(new Calendar(() => Temporal.PlainDate.from('2026-10-02')));
const datesOf = (schedule: Schedule, fromDate: string, toDate: string) => recurrence.dueDates(recurrence.toRecurrence(schedule), fromDate, toDate);

describe('monthly', () => {
	it("clamps a day the month doesn't have to its last day", () => {
		expect(datesOf({ every: 1, unit: 'month', start: '2026-01-31', monthDay: 31 }, '2027-01-01', '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
		expect(datesOf({ every: 1, unit: 'month', start: '2026-01-30', monthDay: 30 }, '2028-02-01', '2028-03-31')).toEqual(['2028-02-29', '2028-03-30']);
	});

	it('twice a month on the 29th and 30th falls on those days, and once in a February that has neither', () => {
		const schedule: Schedule = { every: 1, unit: 'month', start: '2026-01-29', twiceMonthlyDays: [29, 30] };
		expect(datesOf(schedule, '2027-02-01', '2027-04-30')).toEqual(['2027-02-28', '2027-03-29', '2027-03-30', '2027-04-29', '2027-04-30']);
	});

	it('every few months stays aligned with the start, both after and before it', () => {
		const schedule: Schedule = { every: 3, unit: 'month', start: '2026-11-15', monthDay: 15 };
		expect(datesOf(schedule, '2026-01-01', '2027-06-30')).toEqual(['2026-02-15', '2026-05-15', '2026-08-15', '2026-11-15', '2027-02-15', '2027-05-15']);
	});
});

describe('weekly and yearly', () => {
	it("every two weeks stays aligned with the start's weekday, including history", () => {
		const schedule: Schedule = { every: 2, unit: 'week', start: '2026-10-09' };
		expect(datesOf(schedule, '2026-09-20', '2026-11-10')).toEqual(['2026-09-25', '2026-10-09', '2026-10-23', '2026-11-06']);
	});

	it('yearly on Feb 29 falls on Feb 28 in the years between', () => {
		const schedule: Schedule = { every: 1, unit: 'year', start: '2024-02-29' };
		expect(datesOf(schedule, '2026-01-01', '2029-12-31')).toEqual(['2026-02-28', '2027-02-28', '2028-02-29', '2029-02-28']);
	});
});

describe('starts and ends', () => {
	it('has no dates between today and a start set later, but keeps the history before today', () => {
		const schedule: Schedule = { every: 1, unit: 'month', start: '2026-12-15', monthDay: 15 };
		expect(datesOf(schedule, '2026-08-01', '2027-01-31')).toEqual(['2026-08-15', '2026-09-15', '2026-12-15', '2027-01-15']);
		expect(recurrence.nextDueAfterToday(recurrence.toRecurrence(schedule))).toBe('2026-12-15');
	});

	it('finds the next date of a schedule due every few years, and none once a counted one has run out', () => {
		expect(recurrence.nextDueAfterToday(recurrence.toRecurrence({ every: 3, unit: 'year', start: '2026-01-10' }))).toBe('2029-01-10');
		expect(recurrence.nextDueAfterToday('DTSTART:20260105T000000Z\nRRULE:FREQ=WEEKLY;COUNT=2')).toBeNull();
	});

	it('reads malformed rules without failing', () => {
		for (const garbled of [
			'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=0',
			'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=',
			'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1.5',
			'dtstart:20260101T000000Z\nrrule:freq=weekly'
		]) {
			expect(() => recurrence.dueDates(garbled, '2026-01-01', '2026-12-31')).not.toThrow();
		}
		expect(recurrence.fromRecurrence('dtstart:20260109T000000Z\nrrule:freq=weekly;interval=2')).toEqual({ unit: 'week', every: 2, start: '2026-01-09' });
	});
});

describe('saved rules', () => {
	it("reads older saved formats: the last day, a day or the month's last day, and twice a month", () => {
		const lastDay = 'DTSTART:20230101T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1';
		const thirtieth = 'DTSTART:20230101T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30;BYSETPOS=-1';
		const twice = 'DTSTART:20230101T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15,28,29,30;BYSETPOS=1,-1';

		expect(recurrence.dueDates(lastDay, '2027-02-01', '2027-02-28')).toEqual(['2027-02-28']);
		expect(recurrence.dueDates(thirtieth, '2027-02-01', '2027-03-31')).toEqual(['2027-02-28', '2027-03-30']);
		expect(recurrence.fromRecurrence(twice)).toMatchObject({ twiceMonthlyDays: [15, 30] });
		expect(recurrence.dueDates(twice, '2027-02-01', '2027-02-28')).toEqual(['2027-02-15', '2027-02-28']);
	});

	it('stops after COUNT dates', () => {
		expect(recurrence.dueDates('DTSTART:20261005T000000Z\nRRULE:FREQ=WEEKLY;COUNT=2', '2026-10-01', '2026-12-31')).toEqual(['2026-10-05', '2026-10-12']);
	});

	it('round-trips every kind of schedule', () => {
		const schedules: Schedule[] = [
			{ every: 1, unit: 'month', start: '2026-10-31', monthDay: 31 },
			{ every: 1, unit: 'month', start: '2026-10-01', twiceMonthlyDays: [1, 15] },
			{ every: 2, unit: 'week', start: '2026-10-09' },
			{ every: 6, unit: 'month', start: '2026-10-05', monthDay: 5 },
			{ every: 1, unit: 'year', start: '2026-12-25' }
		];
		for (const schedule of schedules) expect(recurrence.fromRecurrence(recurrence.toRecurrence(schedule))).toEqual(schedule);
	});

	it('finds the next due date after a date, and none before a start with a count', () => {
		const schedule = recurrence.toRecurrence({ every: 1, unit: 'month', start: '2026-01-31', monthDay: 31 });
		expect(recurrence.nextDue(schedule, '2027-02-28')).toBe('2027-03-31');
		expect(recurrence.dueDates('DTSTART:20261005T000000Z\nRRULE:FREQ=WEEKLY;COUNT=2', '2026-01-01', '2026-10-04')).toEqual([]);
	});
});
