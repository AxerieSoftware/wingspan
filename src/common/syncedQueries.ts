import type { QueryClient, QueryState } from '@tanstack/query-core';
import { logError } from './log';
import type { SyncScheduler } from './syncScheduler';

const FAILED_FETCH_COOLDOWN_MS = 30_000;

/** Whether the query's last fetch failed too recently to try again yet. */
export function isCoolingDown(state: Pick<QueryState, 'status' | 'errorUpdatedAt'> | undefined): boolean {
	return state?.status === 'error' && Date.now() - state.errorUpdatedAt < FAILED_FETCH_COOLDOWN_MS;
}

/** A query result for a sync: the data, or why there's nothing to show yet. */
export type QueryResult<TData> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: TData };

/** Queries for a sync. Each returns cached data immediately and requests another sync when its fetch returns new data or fails. */
export class SyncedQueries {
	public constructor(
		private readonly queryClient: QueryClient,
		private readonly syncScheduler: SyncScheduler
	) {}

	/** The cached data, including the last good data after a failed refresh. Each call also refreshes it in the background unless it's still fresh or in its retry cooldown. */
	public read<TData>(queryKey: readonly unknown[], fetch: () => Promise<TData>): QueryResult<TData> {
		const cachedData = this.queryClient.getQueryData<TData>(queryKey);
		const state = this.queryClient.getQueryState(queryKey);
		if (!isCoolingDown(state)) {
			// Kept after it goes stale, so a failed refresh still has the last good data to show.
			void this.queryClient.query({ queryKey, queryFn: fetch, gcTime: Number.POSITIVE_INFINITY }).then(
				data => {
					if (data !== cachedData) this.syncScheduler.request();
				},
				(error: unknown) => {
					logError(error);
					this.syncScheduler.request();
				}
			);
		}
		if (cachedData !== undefined) return { status: 'ready', data: cachedData };
		return state?.status === 'error' ? { status: 'failed' } : { status: 'loading' };
	}

	/** When the tab regains focus (e.g. after signing in again), failed queries are retried right away. */
	public forgetFailures(): void {
		this.queryClient.removeQueries({ predicate: query => query.state.status === 'error' && query.state.data === undefined });
	}
}
