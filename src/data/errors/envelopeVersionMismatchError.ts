/** Saved data from a newer version of Wingspan, which this version won't overwrite. */
export class EnvelopeVersionMismatchError extends Error {
	public constructor(
		public readonly savedVersion: number,
		public readonly supportedVersion: number
	) {
		super(`Saved data is version ${savedVersion}; this version of Wingspan supports up to ${supportedVersion}.`);
		this.name = 'EnvelopeVersionMismatchError';
	}
}
