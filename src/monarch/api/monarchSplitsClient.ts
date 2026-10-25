import * as v from 'valibot';
import type { SplitTransaction, TransactionSplit, TransactionSplitInput } from './models/splitTransaction';
import type { TransactionCategory } from './models/transaction';
import type { MonarchClient } from './monarchClient';
import { ensureMutationSucceeded, MutationPayloadSchema } from './mutationPayload';

const SPLIT_FIELDS = `
	id amount notes hideFromReports reviewStatus
	category { id }
	merchant { name }
	tags { id }
	ownedByUser { id }
	businessEntity { id }
	needsReviewByUser { id }
`;

const GET_SPLIT_TRANSACTION_QUERY = `
	query wingspan_GetSplitTransaction($id: UUID!) {
		getTransaction(id: $id) {
			id amount notes hasSplitTransactions
			splitTransactions { ${SPLIT_FIELDS} }
			originalTransaction { id amount notes hasSplitTransactions splitTransactions { ${SPLIT_FIELDS} } }
		}
	}
`;

const GET_CATEGORIES_QUERY = `
	query wingspan_GetCategories {
		categories { id name icon order isDisabled group { order } }
	}
`;

const UPDATE_SPLITS_MUTATION = `
	mutation wingspan_UpdateTransactionSplits($input: UpdateTransactionSplitMutationInput!) {
		updateTransactionSplit(input: $input) {
			transaction { id splitTransactions { id category { id } } }
			errors { message }
		}
	}
`;

const IdSchema = v.nullish(v.object({ id: v.string() }), null);
const SplitSchema = v.object({
	id: v.string(),
	amount: v.number(),
	notes: v.nullish(v.string(), null),
	hideFromReports: v.nullish(v.boolean(), false),
	reviewStatus: v.nullish(v.string(), null),
	category: v.object({ id: v.string() }),
	merchant: v.nullish(v.object({ name: v.string() }), null),
	tags: v.nullish(v.array(v.object({ id: v.string() })), []),
	ownedByUser: IdSchema,
	businessEntity: IdSchema,
	needsReviewByUser: IdSchema
});
const SplitParentSchema = v.object({
	id: v.string(),
	amount: v.number(),
	notes: v.nullish(v.string(), null),
	hasSplitTransactions: v.nullish(v.boolean(), false),
	splitTransactions: v.nullish(v.array(SplitSchema), [])
});
const GetSplitTransactionSchema = v.object({
	getTransaction: v.nullish(v.object({ ...SplitParentSchema.entries, originalTransaction: v.nullish(SplitParentSchema, null) }), null)
});
const GetCategoriesSchema = v.object({
	categories: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			icon: v.nullish(v.string(), null),
			order: v.nullish(v.number(), 0),
			isDisabled: v.nullish(v.boolean(), false),
			group: v.object({ order: v.nullish(v.number(), 0) })
		})
	)
});
const UpdateSplitsSchema = v.object({
	updateTransactionSplit: MutationPayloadSchema({
		transaction: v.nullish(v.object({ id: v.string(), splitTransactions: v.array(v.object({ id: v.string(), category: v.object({ id: v.string() }) })) }), null)
	})
});

/** Reads and rebuilds a transaction's splits, as Monarch's Split Transaction window does. */
export class MonarchSplitsClient {
	public constructor(private readonly client: MonarchClient) {}

	/** The split transaction this one belongs to, or is, or null when it isn't split. */
	public async getSplitTransaction(transactionId: string): Promise<SplitTransaction | null> {
		const { getTransaction } = await this.client.request('wingspan_GetSplitTransaction', GET_SPLIT_TRANSACTION_QUERY, GetSplitTransactionSchema, { id: transactionId });
		const parent = getTransaction?.originalTransaction ?? getTransaction;
		if (!parent?.hasSplitTransactions || !parent.splitTransactions.length) return null;
		return { id: parent.id, amount: parent.amount, notes: parent.notes, splits: parent.splitTransactions.map(toSplit) };
	}

	/** Monarch's categories that are turned on, in Monarch's order by group. */
	public async getCategories(): Promise<TransactionCategory[]> {
		const { categories } = await this.client.request('wingspan_GetCategories', GET_CATEGORIES_QUERY, GetCategoriesSchema);
		return categories
			.filter(category => !category.isDisabled)
			.sort((first, second) => first.group.order - second.group.order || first.order - second.order)
			.map(({ id, name, icon }) => ({ id, name, icon }));
	}

	/** Replaces the transaction's splits with these. Returns the saved splits' ids and categories. */
	public async replaceSplits(transactionId: string, splits: readonly TransactionSplitInput[]): Promise<{ id: string; categoryId: string }[]> {
		const splitData = splits.map(split => ({
			...(split.id ? { id: split.id } : {}),
			amount: split.amount,
			categoryId: split.categoryId,
			notes: split.notes,
			merchantName: split.merchantName,
			tags: split.tagIds,
			hideFromReports: split.hideFromReports,
			...(split.ownerUserId ? { ownerUserId: split.ownerUserId } : {}),
			...(split.businessEntityId ? { businessEntityId: split.businessEntityId } : {}),
			...(split.reviewStatus ? { reviewStatus: split.reviewStatus } : {}),
			...(split.needsReviewByUserId ? { needsReviewByUserId: split.needsReviewByUserId } : {})
		}));
		const { updateTransactionSplit } = await this.client.request('wingspan_UpdateTransactionSplits', UPDATE_SPLITS_MUTATION, UpdateSplitsSchema, { input: { transactionId, splitData } });
		ensureMutationSucceeded(updateTransactionSplit, { logMessage: 'updateTransactionSplit was rejected.', userMessage: "Monarch didn't save the splits." });
		return updateTransactionSplit?.transaction?.splitTransactions.map(split => ({ id: split.id, categoryId: split.category.id })) ?? [];
	}
}

function toSplit(split: v.InferOutput<typeof SplitSchema>): TransactionSplit {
	return {
		id: split.id,
		amount: split.amount,
		categoryId: split.category.id,
		notes: split.notes,
		merchantName: split.merchant?.name ?? '',
		tagIds: split.tags.map(tag => tag.id),
		ownerUserId: split.ownedByUser?.id ?? null,
		businessEntityId: split.businessEntity?.id ?? null,
		hideFromReports: split.hideFromReports,
		reviewStatus: split.reviewStatus,
		needsReviewByUserId: split.needsReviewByUser?.id ?? null
	};
}
