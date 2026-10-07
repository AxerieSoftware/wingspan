import type { Calendar } from '../../common/calendar';
import { LAST_DAY_OF_MONTH } from '../../common/calendar';
import { roundToCents } from '../../common/money';

const MONARCH_LOCALE = 'en-US';
const MONARCH_CURRENCY = 'USD';
const DATE_TIME_ZONE = 'UTC';

/** Money and dates written the way Monarch writes them. */
export class Formatter {
	private readonly moneyFormat: Intl.NumberFormat;
	private readonly wholeMoneyFormat: Intl.NumberFormat;
	private readonly compactMoneyFormat: Intl.NumberFormat;
	private readonly percentFormat: Intl.NumberFormat;
	private readonly shortDateFormat: Intl.DateTimeFormat;
	private readonly longDateFormat: Intl.DateTimeFormat;
	private readonly monthYearFormat: Intl.DateTimeFormat;
	private readonly longMonthYearFormat: Intl.DateTimeFormat;
	private readonly shortMonthFormat: Intl.DateTimeFormat;
	private readonly weekdayFormat: Intl.DateTimeFormat;
	private readonly timeFormat: Intl.DateTimeFormat;

	/** Monarch shows US English only. */
	public readonly locale = MONARCH_LOCALE;
	/** Monarch shows US dollars only. */
	public readonly currency = MONARCH_CURRENCY;

	public constructor(private readonly calendar: Calendar) {
		const { locale, currency } = this;
		this.moneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency });
		this.wholeMoneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
		this.compactMoneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
		this.percentFormat = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
		this.shortDateFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: DATE_TIME_ZONE });
		this.longDateFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: DATE_TIME_ZONE });
		this.monthYearFormat = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: DATE_TIME_ZONE });
		this.longMonthYearFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: DATE_TIME_ZONE });
		this.shortMonthFormat = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: DATE_TIME_ZONE });
		this.weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: DATE_TIME_ZONE });
		// Uses the local time zone, unlike dates, which are calendar days.
		this.timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
	}

	/** Rounded to the cent first, so float noise never shows as "-$0.00". */
	public money(amount: number): string {
		return this.moneyFormat.format(this.withoutNegativeZero(roundToCents(amount)));
	}

	/** Rounded to the dollar, as "$1,235". */
	public wholeMoney(amount: number): string {
		return this.wholeMoneyFormat.format(this.withoutNegativeZero(Math.round(amount)));
	}

	/** "$1.5K", "-$6K", as on Monarch's chart axes. */
	public compactMoney(amount: number): string {
		return this.compactMoneyFormat.format(amount);
	}

	/** A share from 0 to 1, as a whole percent. */
	public percent(share: number): string {
		return this.percentFormat.format(share);
	}

	/** As "Mar 4", without the year. */
	public shortDate(isoDate: string): string {
		return this.shortDateFormat.format(this.parseDate(isoDate));
	}

	/** As "Mar 4, 2026". */
	public longDate(isoDate: string): string {
		return this.longDateFormat.format(this.parseDate(isoDate));
	}

	/** When data was read: the time if today, otherwise the date. */
	public asOf(timestamp: number): string {
		const date = new Date(timestamp);
		const year = String(date.getFullYear()).padStart(4, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const isoDate = `${year}-${month}-${day}`;
		return isoDate === this.calendar.today() ? this.timeFormat.format(date) : this.nearDate(isoDate);
	}

	/** Leaves out the year for dates in the current year. */
	public nearDate(isoDate: string): string {
		const currentYear = this.calendar.today().slice(0, 4);
		return isoDate.startsWith(currentYear) ? this.shortDate(isoDate) : this.longDate(isoDate);
	}

	/** As "Mar 2026". */
	public monthYear(isoDate: string): string {
		return this.monthYearFormat.format(this.parseDate(isoDate));
	}

	/** As "March 2026". */
	public longMonthYear(isoDate: string): string {
		return this.longMonthYearFormat.format(this.parseDate(isoDate));
	}

	/** A `YYYY-MM` month as "Mar '26", for chart axes. */
	public chartMonth(month: string): string {
		return `${this.shortMonthFormat.format(this.parseDate(`${month}-01`))} '${month.slice(2, 4)}`;
	}

	/** The full weekday name, as "Tuesday". */
	public weekday(isoDate: string): string {
		return this.weekdayFormat.format(this.parseDate(isoDate));
	}

	/** As "1st", "2nd" or "11th". */
	public ordinal(value: number): string {
		const lastDigit = value % 10;
		const lastTwoDigits = value % 100;
		if (lastDigit === 1 && lastTwoDigits !== 11) return `${value}st`;
		if (lastDigit === 2 && lastTwoDigits !== 12) return `${value}nd`;
		if (lastDigit === 3 && lastTwoDigits !== 13) return `${value}rd`;
		return `${value}th`;
	}

	/** As "4th of the month". The 31st shows as "Last day of the month", since that's what it means in shorter months. */
	public dayOfMonth(day: number): string {
		return day === LAST_DAY_OF_MONTH ? 'Last day of the month' : `${this.ordinal(day)} of the month`;
	}

	/** Dates are calendar days; formatting them in UTC keeps the browser's offset from shifting the day. */
	private parseDate(isoDate: string): Date {
		return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
	}

	private withoutNegativeZero(amount: number): number {
		return amount === 0 ? 0 : amount;
	}
}
