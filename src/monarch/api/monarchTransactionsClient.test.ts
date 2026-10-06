import { describe, expect, it } from 'vitest';
import type { MonarchClient } from './monarchClient';
import { MonarchTransactionsClient } from './monarchTransactionsClient';

const row = (index: number) => ({ id: `t${index}`, date: '2026-09-01', amount: -1, account: { id: 'checking' } });

describe('reading transactions page by page', () => {
	it('returns each transaction once when a sync shifts the pages between requests', async () => {
		let rows = Array.from({ length: 700 }, (_, index) => row(index));
		const client = {
			request: async (_name: string, _query: string, _schema: unknown, variables: { offset: number; limit: number }) => {
				const page = { allTransactions: { totalCount: rows.length, results: rows.slice(variables.offset, variables.offset + variables.limit) } };
				// One new transaction syncs in at the top after the first page is read.
				if (variables.offset === 0) rows = [row(-1), ...rows];
				return page;
			}
		} as unknown as MonarchClient;

		const transactions = await new MonarchTransactionsClient(client).getTransactions('2026-01-01', '2026-10-03');

		expect(transactions.map(transaction => transaction.id)).toHaveLength(new Set(transactions.map(transaction => transaction.id)).size);
		expect(transactions).toHaveLength(700);
	});
});
