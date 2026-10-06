import * as v from 'valibot';
import { logError } from '../../common/log';
import { lenientArray } from './lenientArray';
import type { Transaction } from './models/transaction';
import type { MonarchClient } from './monarchClient';

const PAGE_SIZE = 500;
// Safety limit of 10,000 transactions.
const MAX_PAGES = 20;

const GET_TRANSACTIONS_QUERY = `
	query wingspan_GetTransactions($filters: TransactionFilterInput, $offset: Int, $limit: Int) {
		allTransactions(filters: $filters) {
			totalCount
			results(offset: $offset, limit: $limit, orderBy: date) {
				id date amount plaidName isRecurring hideFromReports pending
				merchant { id name logoUrl }
				category { id name icon group { type } }
				account { id }
			}
		}
	}
`;

const MonarchTransactionSchema = v.object({
	id: v.string(),
	date: v.string(),
	amount: v.number(),
	plaidName: v.nullish(v.string()),
	merchant: v.nullish(v.object({ id: v.string(), name: v.string(), logoUrl: v.nullish(v.string()) })),
	isRecurring: v.nullish(v.boolean()),
	hideFromReports: v.nullish(v.boolean()),
	pending: v.nullish(v.boolean()),
	category: v.nullish(v.object({ id: v.string(), name: v.string(), icon: v.nullish(v.string()), group: v.nullish(v.object({ type: v.string() })) })),
	account: v.nullish(v.object({ id: v.string() }))
});

type MonarchTransaction = v.InferOutput<typeof MonarchTransactionSchema>;

const GetTransactionsSchema = v.object({ allTransactions: v.object({ totalCount: v.number(), results: lenientArray('transactions', MonarchTransactionSchema) }) });

export class MonarchTransactionsClient {
	public constructor(private readonly client: MonarchClient) {}

	/**
	 * Reads page by page while Monarch may be syncing in new transactions. Returns only those that existed when the first
	 * page was requested, in a fixed order, with no duplicates even if the pages shift.
	 */
	public async getTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
		const transactionsById = new Map<string, Transaction>();
		const filters = { startDate, endDate, createdBeforeOrAt: new Date().toISOString() };
		for (let page = 0; page < MAX_PAGES; page++) {
			const variables = { filters, offset: page * PAGE_SIZE, limit: PAGE_SIZE };
			const { allTransactions } = await this.client.request('wingspan_GetTransactions', GET_TRANSACTIONS_QUERY, GetTransactionsSchema, variables);

			for (const result of allTransactions.results) transactionsById.set(result.id, this.toTransaction(result));
			// Monarch's total tells when the last page is read. It counts everything Monarch sent, including malformed entries that were skipped.
			if ((page + 1) * PAGE_SIZE >= allTransactions.totalCount) return [...transactionsById.values()];
		}

		logError(new Error(`Read only the first ${MAX_PAGES * PAGE_SIZE} transactions since ${startDate}.`));
		return [...transactionsById.values()];
	}

	private toTransaction(result: MonarchTransaction): Transaction {
		return {
			id: result.id,
			date: result.date,
			amount: result.amount,
			description: result.plaidName ?? '',
			merchantName: result.merchant?.name,
			merchantId: result.merchant?.id,
			logoUrl: result.merchant?.logoUrl ?? undefined,
			category: result.category ? { id: result.category.id, name: result.category.name, icon: result.category.icon ?? null, groupType: result.category.group?.type } : undefined,
			accountId: result.account?.id,
			isRecurring: result.isRecurring ?? false,
			hideFromReports: result.hideFromReports ?? false,
			pending: result.pending ?? false
		};
	}
}
