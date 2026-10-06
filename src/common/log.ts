const LOG_PREFIX = '[Wingspan]';

/** Logs to the console with a "[Wingspan]" prefix, to tell it apart from Monarch's own errors. */
export function logError(error: unknown): void {
	console.error(LOG_PREFIX, error);
}
