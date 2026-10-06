/** Half a cent. Amounts closer than this are treated as equal, so floating-point error is never counted as money. */
export const CENT_TOLERANCE = 0.005;
/** For turning a yearly rate into a daily one. Leap years are ignored. */
export const DAYS_PER_YEAR = 365;
export const MONTHS_PER_YEAR = 12;
/** Divide a percentage by this to get a fraction, e.g. an APR of 24 becomes 0.24. */
export const PERCENT = 100;

const CENTS_PRECISION_DIGITS = 6;

/** The nearest cent, for amounts shown or saved. Floating-point error is removed first and half a cent rounds away from zero, so 1.005 is 1.01 and -1.005 is -1.01. */
export function roundToCents(amount: number): number {
	const rounded = Math.round(Number((Math.abs(amount) * 100).toFixed(CENTS_PRECISION_DIGITS))) / 100;
	// `|| 0` keeps a negative amount that rounds to nothing from coming out as -0, which shows as "-$0.00".
	return amount < 0 ? -rounded || 0 : rounded;
}

/** Down to the cent, for amounts to pay or move, so they never exceed what's available. Floating-point error is removed first, so 0.29 stays 0.29. */
export function floorToCents(amount: number): number {
	return Math.floor(Number((amount * 100).toFixed(CENTS_PRECISION_DIGITS))) / 100;
}
