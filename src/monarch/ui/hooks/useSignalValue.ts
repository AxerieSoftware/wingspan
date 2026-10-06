import type { ReadonlySignal } from '@preact/signals-core';
import { useCallback, useSyncExternalStore } from 'react';

/** A signal's current value; re-renders when it changes. */
export function useSignalValue<TValue>(source: ReadonlySignal<TValue>): TValue {
	const subscribe = useCallback((onChange: () => void) => source.subscribe(() => onChange()), [source]);
	return useSyncExternalStore(subscribe, () => source.value);
}
