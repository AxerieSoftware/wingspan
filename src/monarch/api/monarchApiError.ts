/** Shown when no one is signed in to Monarch on the page, or Monarch rejects the session. */
export const SIGNED_OUT_MESSAGE = 'Monarch signed you out. Sign in again.';

/** A failed request to Monarch, with a message that's safe to show the user. */
export class MonarchApiError extends Error {
	/** Whether a retry could help: true when Monarch is unreachable or erroring, false when it rejected the request. */
	public readonly isRetryable: boolean;

	public constructor(message: string, isRetryable: boolean, options?: ErrorOptions) {
		super(message, options);
		this.name = 'MonarchApiError';
		this.isRetryable = isRetryable;
	}
}
