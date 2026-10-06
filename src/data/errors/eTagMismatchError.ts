/** Saved data changed since it was read, e.g. another tab or browser saved in the meantime. The save re-reads and retries. */
export class ETagMismatchError extends Error {
	public constructor(
		public readonly savedETag: string,
		public readonly expectedETag: string
	) {
		super(`Saved data changed since it was read: ETag ${savedETag}, expected ${expectedETag}.`);
		this.name = 'ETagMismatchError';
	}
}
