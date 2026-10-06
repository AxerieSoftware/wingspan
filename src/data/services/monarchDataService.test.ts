import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { Calendar } from '../../common/calendar';
import type { MonarchAccountsClient } from '../../monarch/api/monarchAccountsClient';
import type { MonarchRecurringClient } from '../../monarch/api/monarchRecurringClient';
import type { MonarchTransactionsClient } from '../../monarch/api/monarchTransactionsClient';
import { MonarchDataService } from './monarchDataService';

describe("Monarch's data after a refresh fails", () => {
	it('keeps showing the previous data, marked as stale, until a refresh succeeds', async () => {
		let isDown = false;
		const reachable = async <T>(value: T) => {
			if (isDown) throw new Error("Monarch couldn't be reached.");
			return value;
		};
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const service = new MonarchDataService(
			queryClient,
			{ getTransactions: () => reachable([]) } as unknown as MonarchTransactionsClient,
			{
				getAccounts: () => reachable([{ id: 'card', displayName: 'Card', currentBalance: -100, isAsset: false, isHidden: false, type: { name: 'credit', display: 'Credit' } }])
			} as unknown as MonarchAccountsClient,
			{ getRecurringFlows: () => reachable([]) } as unknown as MonarchRecurringClient,
			new Calendar(() => Temporal.PlainDate.from('2026-10-03')),
			30
		);

		await service.load();
		isDown = true;
		await queryClient.invalidateQueries();
		await service.load();

		expect(service.snapshot.value?.owedByAccountId).toEqual({ card: 100 });
		expect(service.state.value).toMatchObject({ status: 'ready', isStale: true });

		isDown = false;
		service.forgetFailure();
		await queryClient.invalidateQueries();
		await service.load();
		expect(service.state.value).toMatchObject({ status: 'ready', isStale: false });
	});
});
