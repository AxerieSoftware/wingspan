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
	const subtractLine = (fromLine: RecurringSummaryLine, lessLine: RecurringSummaryLine): RecurringSummaryLine => ({
		completed: roundToCents(fromLine.completed - lessLine.completed),
		remaining: roundToCents(fromLine.remaining - lessLine.remaining),
		total: roundToCents(fromLine.total - lessLine.total)
	});
	return { expense: subtractLine(from.expense, less.expense), income: subtractLine(from.income, less.income) };
}
