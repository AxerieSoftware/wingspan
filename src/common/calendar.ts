/** A date as "YYYY-MM-DD". Checks the shape only, not that the day exists. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** The highest day of any month. As a due day, it means the last day of the month. */
export const LAST_DAY_OF_MONTH = 31;

/** Calendar dates as ISO strings ("YYYY-MM-DD", months "YYYY-MM"), which also compare correctly as strings. */
export class Calendar {
	private readonly datesFrom = new Map<string, string[]>();

	public constructor(private readonly currentDate: () => Temporal.PlainDate = () => Temporal.Now.plainDateISO()) {}

	/** Today's date in the browser's time zone. */
	public today(): string {
		return this.currentDate().toString();
	}

	public currentMonth(): string {
		return this.monthOf(this.today());
	}

	public monthOf(isoDate: string): string {
		return isoDate.slice(0, 7);
	}

	public dayOf(isoDate: string): number {
		return Number(isoDate.slice(8, 10));
	}

	/** Every date from the first through the last, inclusive. Cached by start date, since projections iterate the same days often. */
	public datesBetween(firstDate: string, lastDate: string): string[] {
		let dates = this.datesFrom.get(firstDate);
		if (!dates) {
			dates = [firstDate];
			this.datesFrom.set(firstDate, dates);
		}
		for (let date = Temporal.PlainDate.from(dates.at(-1) as string); (dates.at(-1) as string) < lastDate; ) {
			date = date.add({ days: 1 });
			dates.push(date.toString());
		}
		const lastIndex = dates.indexOf(lastDate);
		return lastIndex === -1 ? [] : dates.slice(0, lastIndex + 1);
	}

	public addDays(isoDate: string, days: number): string {
		return Temporal.PlainDate.from(isoDate).add({ days }).toString();
	}

	/** Days from the first date to the second, negative when the second is earlier. */
	public daysBetween(fromDate: string, toDate: string): number {
		return Temporal.PlainDate.from(fromDate).until(toDate).days;
	}

	public addMonths(month: string, months: number): string {
		return Temporal.PlainYearMonth.from(month).add({ months }).toString();
	}

	/** Whole months from the first month to the second, negative when the second is earlier. */
	public monthsBetween(fromMonth: string, toMonth: string): number {
		return Temporal.PlainYearMonth.from(fromMonth).until(toMonth, { largestUnit: 'months' }).months;
	}

	/** The month's last date, as "2024-02-29" for "2024-02". */
	public lastOfMonth(month: string): string {
		return Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 }).with({ day: LAST_DAY_OF_MONTH }).toString();
	}

	/** A day past the end of the month is clamped to its last day, so the 31st works in February. */
	public dayInMonth(month: string, day: number): string {
		return Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 }).with({ day }).toString();
	}
}
