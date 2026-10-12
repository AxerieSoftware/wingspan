/** Monarch's business filter for its totals: chosen businesses, plus Household as "unassigned". */
export interface BusinessEntitySetInput {
	businessEntityIds: string[];
	includeUnassigned: boolean;
}

/** Inclusive "YYYY-MM-DD" dates, and the business filter, left out when every entity is shown. */
export interface IncomeRequest {
	startDate: string;
	endDate: string;
	businessEntitySet?: BusinessEntitySetInput;
}
