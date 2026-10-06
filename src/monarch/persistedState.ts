/** A field of one of Monarch's redux-persist slices, which keeps each field as its own JSON string. Undefined when missing or unreadable. */
export function readPersistedField(storage: Storage, sliceKey: string, field: string): unknown {
	return parsePersistedField(storage.getItem(sliceKey), field);
}

/** `readPersistedField` for a slice's JSON already read from storage. */
export function parsePersistedField(sliceJson: string | null, field: string): unknown {
	try {
		const slice = JSON.parse(sliceJson ?? '{}') as Record<string, unknown>;
		const fieldJson = slice[field];
		return typeof fieldJson === 'string' ? JSON.parse(fieldJson) : undefined;
	} catch {
		return undefined;
	}
}
