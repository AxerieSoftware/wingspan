/** Saved data Wingspan can't read, so it's left alone instead of being replaced. */
export class InvalidSavedDataError extends Error {
	public constructor(
		public readonly source: string,
		public readonly problems: string
	) {
		super(`Saved data in ${source} couldn't be read: ${problems}`);
		this.name = 'InvalidSavedDataError';
	}
}
