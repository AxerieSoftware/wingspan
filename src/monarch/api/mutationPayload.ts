import * as v from 'valibot';
import { logError } from '../../common/log';
import { MonarchApiError } from './monarchApiError';

/** A mutation's payload: its own fields plus the `errors` Monarch returns when it rejects the change. */
export const MutationPayloadSchema = <TEntries extends v.ObjectEntries>(entries: TEntries) => v.nullish(v.object({ ...entries, errors: v.nullish(v.object({ message: v.nullish(v.string()) })) }));

/** What to log and what to tell the user when Monarch rejects a mutation. */
export interface MutationRejection {
	logMessage: string;
	userMessage: string;
}

/** Throws when Monarch rejected the mutation, whether or not it gave a message. */
export function ensureMutationSucceeded(payload: { errors?: unknown } | null | undefined, rejection: MutationRejection): void {
	if (!payload?.errors) return;
	// Monarch's message isn't logged, since it can include the household data that was sent.
	logError(new Error(rejection.logMessage));
	throw new MonarchApiError(rejection.userMessage, false);
}
