import * as v from 'valibot';
import { logError } from '../../common/log';
import { lenientArray } from './lenientArray';
import type { BusinessEntitySetInput } from './models/incomeRequest';
import type { TaggedTransaction, TransactionTag } from './models/taggedTransaction';
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
				id date amount plaidName hideFromReports pending
				merchant { id name logoUrl }
				category { id name icon group { type } }
				account { id }
			}
		}
	}
`;

// Asking for each transaction's recurrenceGroup takes Monarch about 20 ms per transaction, so the links come from the groups instead.
const GET_RECURRING_LINKS_QUERY = `
	query wingspan_GetRecurringLinks {
		recurrenceGroupsForPeriod(includeInactive: true, filters: {}) {
			recurrenceGroup { id transactions { id } }
		}
	}
`;

const GET_TAGGED_TRANSACTIONS_QUERY = `
	query wingspan_GetTaggedTransactions($filters: TransactionFilterInput, $offset: Int, $limit: Int) {
		allTransactions(filters: $filters) {
			totalCount
			results(offset: $offset, limit: $limit, orderBy: date) {
				id date amount plaidName notes
				merchant { name logoUrl }
				account { displayName }
				attachments { id }
				tags { id }
			}
		}
	}
`;

const GET_NEEDS_REVIEW_COUNT_QUERY = `
	query wingspan_GetNeedsReviewCount($filters: TransactionFilterInput) {
		allTransactions(filters: $filters) { totalCount }
	}
`;

const GET_TRANSACTION_TAGS_QUERY = `
	query wingspan_GetTransactionTags {
		householdTransactionTags { id name color }
	}
`;

const NeedsReviewCountSchema = v.object({ allTransactions: v.object({ totalCount: v.number() }) });

const MonarchTransactionSchema = v.object({
	id: v.string(),
	date: v.string(),
	amount: v.number(),
	plaidName: v.nullish(v.string()),
	merchant: v.nullish(v.object({ id: v.string(), name: v.string(), logoUrl: v.nullish(v.string()) })),
	hideFromReports: v.nullish(v.boolean()),
	pending: v.nullish(v.boolean()),
	category: v.nullish(v.object({ id: v.string(), name: v.string(), icon: v.nullish(v.string()), group: v.nullish(v.object({ type: v.string() })) })),
	account: v.nullish(v.object({ id: v.string() }))
});

const MonarchTaggedTransactionSchema = v.object({
	id: v.string(),
	date: v.string(),
	amount: v.number(),
	plaidName: v.nullish(v.string()),
	notes: v.nullish(v.string()),
	merchant: v.nullish(v.object({ name: v.string(), logoUrl: v.nullish(v.string()) })),
	account: v.nullish(v.object({ displayName: v.string() })),
	attachments: v.array(v.object({ id: v.string() })),
	tags: v.array(v.object({ id: v.string() }))
});

type MonarchTransaction = v.InferOutput<typeof MonarchTransactionSchema>;
type MonarchTaggedTransaction = v.InferOutput<typeof MonarchTaggedTransactionSchema>;

const GetTransactionsSchema = v.object({ allTransactions: v.object({ totalCount: v.number(), results: lenientArray('transactions', MonarchTransactionSchema) }) });
const GetTaggedTransactionsSchema = v.object({ allTransactions: v.object({ totalCount: v.number(), results: lenientArray('tagged transactions', MonarchTaggedTransactionSchema) }) });
const GetRecurringLinksSchema = v.object({
	recurrenceGroupsForPeriod: lenientArray('recurring items', v.object({ recurrenceGroup: v.object({ id: v.string(), transactions: v.nullish(v.array(v.object({ id: v.string() })), []) }) }))
});
const GetTransactionTagsSchema = v.object({ householdTransactionTags: lenientArray('transaction tags', v.object({ id: v.string(), name: v.string(), color: v.string() })) });

interface TransactionsPage<TResult> {
	allTransactions: { totalCount: number; results: TResult[] };
}

/** Reads the household's transactions. */
export class MonarchTransactionsClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Every transaction from `startDate` to `endDate`, in a fixed order, each with the recurring item Monarch ties it to. */
	public async getTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
		const [results, recurrenceGroupIdByTransactionId] = await Promise.all([
			this.readAllPages('wingspan_GetTransactions', GET_TRANSACTIONS_QUERY, GetTransactionsSchema, { startDate, endDate }, `since ${startDate}`),
			this.getRecurringLinks()
		]);
		return results.map(result => this.toTransaction(result, recurrenceGroupIdByTransactionId.get(result.id)));
	}

	/** Every transaction with the tag, from any date. */
	public async getTaggedTransactions(tagId: string): Promise<TaggedTransaction[]> {
		const results = await this.readAllPages('wingspan_GetTaggedTransactions', GET_TAGGED_TRANSACTIONS_QUERY, GetTaggedTransactionsSchema, { tags: [tagId] }, 'with a tag');
		return results.map(result => this.toTaggedTransaction(result));
	}

	/** How many transactions Monarch marks as needing review, within the business filter when there is one. */
	public async getNeedsReviewCount(businessEntitySet: BusinessEntitySetInput | undefined): Promise<number> {
		const { allTransactions } = await this.client.request('wingspan_GetNeedsReviewCount', GET_NEEDS_REVIEW_COUNT_QUERY, NeedsReviewCountSchema, { filters: { needsReview: true, businessEntitySet } });
		return allTransactions.totalCount;
	}

	/** The household's tags, in Monarch's order. */
	public async getTransactionTags(): Promise<TransactionTag[]> {
		const { householdTransactionTags } = await this.client.request('wingspan_GetTransactionTags', GET_TRANSACTION_TAGS_QUERY, GetTransactionTagsSchema);
		return householdTransactionTags;
	}

	/**
	 * Reads page by page while Monarch may be syncing in new transactions. Returns only those that existed when the first
	 * page was requested, in a fixed order, with no duplicates even if the pages shift.
	 */
	private async readAllPages<TResult extends { id: string }>(
		operationName: string,
		query: string,
		schema: v.GenericSchema<unknown, TransactionsPage<TResult>>,
		filters: Record<string, unknown>,
		description: string
	): Promise<TResult[]> {
		const resultsById = new Map<string, TResult>();
		const pinnedFilters = { ...filters, createdBeforeOrAt: new Date().toISOString() };
		for (let page = 0; page < MAX_PAGES; page++) {
			const variables = { filters: pinnedFilters, offset: page * PAGE_SIZE, limit: PAGE_SIZE };
			const { allTransactions } = await this.client.request(operationName, query, schema, variables);

			for (const result of allTransactions.results) resultsById.set(result.id, result);
			// Monarch's total tells when the last page is read. It counts everything Monarch sent, including malformed entries that were skipped.
			if ((page + 1) * PAGE_SIZE >= allTransactions.totalCount) return [...resultsById.values()];
		}

		logError(new Error(`Read only the first ${MAX_PAGES * PAGE_SIZE} transactions ${description}.`));
		return [...resultsById.values()];
	}

	private async getRecurringLinks(): Promise<Map<string, string>> {
		const { recurrenceGroupsForPeriod } = await this.client.request('wingspan_GetRecurringLinks', GET_RECURRING_LINKS_QUERY, GetRecurringLinksSchema);
		return new Map(recurrenceGroupsForPeriod.flatMap(({ recurrenceGroup }) => recurrenceGroup.transactions.map(transaction => [transaction.id, recurrenceGroup.id] as const)));
	}

	private toTransaction(result: MonarchTransaction, recurrenceGroupId: string | undefined): Transaction {
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
			recurrenceGroupId,
			hideFromReports: result.hideFromReports ?? false,
			pending: result.pending ?? false
		};
	}

	private toTaggedTransaction(result: MonarchTaggedTransaction): TaggedTransaction {
		return {
			id: result.id,
			date: result.date,
			amount: result.amount,
			merchantName: result.merchant?.name ?? result.plaidName ?? '',
			logoUrl: result.merchant?.logoUrl ?? undefined,
			accountName: result.account?.displayName,
			notes: result.notes ?? '',
			hasAttachments: result.attachments.length > 0,
			tagIds: result.tags.map(tag => tag.id)
		};
	}
}
