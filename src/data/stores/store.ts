import type { Envelope } from '../models/envelope';

/** Where an envelope is saved. `store` refuses to overwrite a newer version or a copy that changed since `load`, and returns the envelope with its new ETag. */
export interface Store<TValue> {
	load(): Promise<Envelope<TValue> | undefined>;
	store(envelope: Envelope<TValue>): Promise<Envelope<TValue>>;
}
