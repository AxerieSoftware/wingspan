import * as v from 'valibot';
import { EnvelopeVersionMismatchError } from '../errors/envelopeVersionMismatchError';
import { ETagMismatchError } from '../errors/eTagMismatchError';

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

/** Throws unless `envelope` may replace `savedEnvelope`: never over a newer version, or over a copy that changed since it was read. */
export function ensureCanOverwrite(savedEnvelope: Envelope<unknown> | undefined, envelope: Envelope<unknown>): void {
	if (!savedEnvelope) return;
	if (savedEnvelope.version > envelope.version) throw new EnvelopeVersionMismatchError(savedEnvelope.version, envelope.version);
	if (savedEnvelope.etag !== envelope.etag) throw new ETagMismatchError(savedEnvelope.etag, envelope.etag);
}

/** Whether `version`, as "1.2.3", is later than `than`. Returns false if either can't be parsed. */
export function isNewerVersion(version: string | undefined, than: string): boolean {
	if (!version) return false;

	const toParts = (text: string) => text.split('.').map(part => Number.parseInt(part, 10));
	const [ours, theirs] = [toParts(version), toParts(than)];
	if ([...ours, ...theirs].some(part => Number.isNaN(part))) return false;
	for (let index = 0; index < Math.max(ours.length, theirs.length); index++) {
		const difference = (ours[index] ?? 0) - (theirs[index] ?? 0);
		if (difference) return difference > 0;
	}
	return false;
}
