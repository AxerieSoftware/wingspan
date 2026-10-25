/** Month names as Monarch abbreviates them, January first. */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Matches Monarch's money format, as "-$1,250.00" or "$4,800". */
const MONEY_PATTERN = /^(-)?\$([\d,]+(?:\.\d+)?)$/;
/** "May 1, 2024". */
const SHORT_DATE_PATTERN = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/;
/** "October 2026" or "Oct 2026". */
const MONTH_YEAR_PATTERN = /^([A-Z][a-z]+) (\d{4})$/;

/** An amount as Monarch writes it. Null for any other text. */
export function parseMoney(text: string): number | null {
	const match = MONEY_PATTERN.exec(text.trim());
	if (!match?.[2]) return null;
	const amount = Number(match[2].replaceAll(',', ''));
	return match[1] ? -amount : amount;
}

/** A date as Monarch writes it, like "May 1, 2024", as "YYYY-MM-DD". Null for any other text. */
export function parseShortDate(text: string): string | null {
	const match = SHORT_DATE_PATTERN.exec(text.trim());
	const month = monthNumber(match?.[1] ?? '');
	return match && month ? `${match[3]}-${month}-${(match[2] ?? '').padStart(2, '0')}` : null;
}

/** A month as Monarch writes it in a heading, like "October 2026", as "YYYY-MM". Null for any other text. */
export function parseMonthYear(text: string): string | null {
	const match = MONTH_YEAR_PATTERN.exec(text.trim());
	const month = monthNumber(match?.[1] ?? '');
	return match && month ? `${match[2]}-${month}` : null;
}

/** "01" through "12" for a month name, full or abbreviated. Null for anything else. */
function monthNumber(name: string): string | null {
	const index = name.length >= 3 ? MONTH_NAMES.findIndex(monthName => name.startsWith(monthName)) : -1;
	return index >= 0 ? String(index + 1).padStart(2, '0') : null;
}
