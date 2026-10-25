/** A category's average per month over recent full months, and its total so far this year. A month with nothing in the category counts as $0. */
export interface CategoryAverages {
	threeMonths: number;
	twelveMonths: number;
	/** Over this year's full months. Null in January, which has none yet. */
	yearToDate: number | null;
	/** This year's total through today, the current month included. */
	thisYear: number;
}
