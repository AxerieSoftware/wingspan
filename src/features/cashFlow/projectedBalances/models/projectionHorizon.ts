/** How many days ahead the projection runs, which is also how far ahead Monarch's recurring items are needed. */
export const PROJECTED_DAYS = 365;

/** How many days ahead to look for the next payday. This is also the longest window free cash is protected for. */
export const PAYDAY_SEARCH_DAYS = 90;

/** A card with no known due date is assumed due this many days out. */
export const UNKNOWN_DUE_DAYS = 30;

const SHORTEST_MONTH_DAYS = 28;
/** The most calendar months the free cash window can span, including the current one: Jan 31 plus 90 days reaches May. */
export const REVERSIBLE_WINDOW_MONTHS = Math.ceil(PAYDAY_SEARCH_DAYS / SHORTEST_MONTH_DAYS) + 1;

/** How many months back a payment Monarch still marks overdue is carried into the projection. */
export const OVERDUE_CARRY_MONTHS = 2;
