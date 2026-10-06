/** When the card's statement dates aren't known, assume the statement closes this many days before it's due, which is typical. */
export const STATEMENT_CLOSE_DAYS_BEFORE_DUE = 25;

/**
 * Used for a statement a payment was matched to. It's at the late end of when cards usually close, so charges after it
 * count toward the next statement, and a statement paid in full shows $0 instead of a few days of spending.
 */
export const PAID_STATEMENT_CLOSE_DAYS_BEFORE_DUE = 28;
