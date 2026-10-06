import type { StorageScope } from '../../data/stores/storageScope';
import { MonarchAccountsClient } from './monarchAccountsClient';
import { MonarchBudgetClient } from './monarchBudgetClient';
import { MonarchClient } from './monarchClient';
import { MonarchReceiptsClient } from './monarchReceiptsClient';
import { MonarchRecurringClient } from './monarchRecurringClient';
import { MonarchRequestHook } from './monarchRequestHook';
import { MonarchTransactionsClient } from './monarchTransactionsClient';

export interface MonarchApi {
	accounts: MonarchAccountsClient;
	budget: MonarchBudgetClient;
	receipts: MonarchReceiptsClient;
	recurring: MonarchRecurringClient;
	transactions: MonarchTransactionsClient;
}

/** Monarch's GraphQL API, sent as Wingspan and only for the household signed in on this page. */
export function createMonarchApi(window: Window, version: string, scope: StorageScope): MonarchApi {
	const client = new MonarchClient(new MonarchRequestHook(window.document), `wingspan/${version}`, () => scope.checkSameHousehold());
	return {
		accounts: new MonarchAccountsClient(client),
		budget: new MonarchBudgetClient(client),
		receipts: new MonarchReceiptsClient(client),
		recurring: new MonarchRecurringClient(client),
		transactions: new MonarchTransactionsClient(client)
	};
}
