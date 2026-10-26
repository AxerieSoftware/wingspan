import type { StorageScope } from '../../data/stores/storageScope';
import { MonarchAccountsClient } from './monarchAccountsClient';
import { MonarchBudgetClient } from './monarchBudgetClient';
import { MonarchCashFlowClient } from './monarchCashFlowClient';
import { MonarchClient } from './monarchClient';
import { MonarchGoalsClient } from './monarchGoalsClient';
import { MonarchLoansClient } from './monarchLoansClient';
import { MonarchReceiptsClient } from './monarchReceiptsClient';
import { MonarchRecurringClient } from './monarchRecurringClient';
import { MonarchRequestHook } from './monarchRequestHook';
import { MonarchTransactionsClient } from './monarchTransactionsClient';

export interface MonarchApi {
	accounts: MonarchAccountsClient;
	budget: MonarchBudgetClient;
	cashFlow: MonarchCashFlowClient;
	goals: MonarchGoalsClient;
	loans: MonarchLoansClient;
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
		cashFlow: new MonarchCashFlowClient(client),
		goals: new MonarchGoalsClient(client),
		loans: new MonarchLoansClient(client),
		receipts: new MonarchReceiptsClient(client),
		recurring: new MonarchRecurringClient(client),
		transactions: new MonarchTransactionsClient(client)
	};
}
