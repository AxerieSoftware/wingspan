import * as v from 'valibot';

/** Saved data with its schema version and an ETag that changes on every write, so a save never overwrites data it didn't read. */
export interface Envelope<TValue> {
	version: number;
	etag: string;
	value: TValue;
	wingspanVersion?: string;
}

/** The envelope's shape only. Its value is checked separately. */
export const EnvelopeSchema = v.looseObject({
	version: v.pipe(v.number(), v.integer(), v.minValue(1)),
	etag: v.string(),
	value: v.unknown(),
	wingspanVersion: v.optional(v.string())
});

/** Whether `version`, as "1.2.3", is later than `than`. Returns false if either can't be parsed. */
export function isNewerVersion(version: string | undefined, than: string): boolean {
	const parts = (text: string) => text.split('.').map(part => Number.parseInt(part, 10));
	if (!version) return false;
	const [ours, theirs] = [parts(version), parts(than)];
	if ([...ours, ...theirs].some(part => Number.isNaN(part))) return false;
	for (let index = 0; index < Math.max(ours.length, theirs.length); index++) {
		const difference = (ours[index] ?? 0) - (theirs[index] ?? 0);
		if (difference) return difference > 0;
	}
	return false;
}
