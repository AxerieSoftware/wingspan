import { roundToCents } from '../../../common/money';

/** Uses Monarch's sign convention: expenses are negative. */
export interface RecurringSummaryLine {
	completed: number;
	remaining: number;
	total: number;
}

export interface RecurringSummary {
	expense: RecurringSummaryLine;
	income: RecurringSummaryLine;
}

export const EMPTY_SUMMARY: RecurringSummary = { expense: { completed: 0, remaining: 0, total: 0 }, income: { completed: 0, remaining: 0, total: 0 } };

/** `from` minus `less` for each line, rounded to the cent. */
export function subtractSummary(from: RecurringSummary, less: RecurringSummary): RecurringSummary {
	const line = (a: RecurringSummaryLine, b: RecurringSummaryLine): RecurringSummaryLine => ({
		completed: roundToCents(a.completed - b.completed),
		remaining: roundToCents(a.remaining - b.remaining),
		total: roundToCents(a.total - b.total)
	});
	return { expense: line(from.expense, less.expense), income: line(from.income, less.income) };
}
