import * as v from 'valibot';
import { storage } from 'wxt/utils/storage';
import { InvalidSavedDataError } from '../errors/invalidSavedDataError';
import { type Envelope, EnvelopeSchema, ensureCanOverwrite } from '../models/envelope';
import type { Store } from './store';

/** The data source name used in error messages. */
export const BROWSER_SOURCE = 'this browser';

/** Saves the envelope in this browser's extension storage, with a key per household. */
export class BrowserLocalStore<TValue> implements Store<TValue> {
	public constructor(private readonly key: () => `local:${string}`) {}

	/** Saved data in an unexpected format is reported as an error, never treated as missing, so it's never overwritten. */
	public async load(): Promise<Envelope<TValue> | undefined> {
		const savedEnvelope = await storage.getItem<unknown>(this.key());
		if (savedEnvelope === null || savedEnvelope === undefined) return undefined;
		if (!v.is(EnvelopeSchema, savedEnvelope)) throw new InvalidSavedDataError(BROWSER_SOURCE, "it isn't Wingspan's format");
		return savedEnvelope as Envelope<TValue>;
	}

	/** Refuses to overwrite a newer version or a copy that changed since it was read. Returns the envelope as saved, with its new ETag. */
	public async store(envelope: Envelope<TValue>): Promise<Envelope<TValue>> {
		const savedEnvelope = await this.load();
		ensureCanOverwrite(savedEnvelope, envelope);

		const storedEnvelope = { ...envelope, etag: crypto.randomUUID() };
		await storage.setItem(this.key(), storedEnvelope);
		return storedEnvelope;
	}
}
