import * as v from 'valibot';
import { MonarchApiError } from './monarchApiError';
import type { MonarchClient } from './monarchClient';
import { ensureMutationSucceeded, MutationPayloadSchema, type MutationRejection } from './mutationPayload';

/** Monarch's own receipt upload takes at most this many files at once. */
export const RECEIPTS_PER_UPLOAD = 10;

const CREATE_RECEIPT_SYNCS_MUTATION = `
	mutation wingspan_CreateReceiptSyncs($input: CreateBulkRetailSyncInput!) {
		createBulkRetailSync(input: $input) {
			retailSyncs { id }
			errors { message }
		}
	}
`;

const START_RECEIPT_SYNC_MUTATION = `
	mutation wingspan_StartReceiptSync($syncId: ID!) {
		startRetailSync(id: $syncId) {
			retailSync { id }
			errors { message }
		}
	}
`;

const EXISTING_RECEIPTS_QUERY = `
	query wingspan_GetExistingReceipts($filters: RetailOrderFiltersInput, $first: Int, $after: String) {
		retailOrdersConnection(filters: $filters, first: $first, after: $after) {
			pageInfo { hasNextPage endCursor }
			edges { node { merchantName grandTotal date } }
		}
	}
`;
const EXISTING_PAGE_SIZE = 100;
const MAX_EXISTING_PAGES = 20;

const ExistingReceiptsSchema = v.object({
	retailOrdersConnection: v.nullish(
		v.object({
			pageInfo: v.object({ hasNextPage: v.boolean(), endCursor: v.nullish(v.string()) }),
			edges: v.array(v.object({ node: v.object({ merchantName: v.nullish(v.string()), grandTotal: v.nullish(v.number()), date: v.nullish(v.string()) }) }))
		})
	)
});

/** A receipt or order Monarch already has, from any source: its own retail sync, an upload, or Wingspan. */
export interface ExistingReceipt {
	merchant: string;
	total: number;
	/** "YYYY-MM-DD". */
	date: string;
}

const CreateReceiptSyncsSchema = v.object({ createBulkRetailSync: MutationPayloadSchema({ retailSyncs: v.nullish(v.array(v.object({ id: v.string() }))) }) });
const StartReceiptSyncSchema = v.object({ startRetailSync: MutationPayloadSchema({ retailSync: v.nullish(v.object({ id: v.string() })) }) });
const UPLOAD_REJECTED: MutationRejection = { logMessage: 'Monarch rejected a receipt upload.', userMessage: "The receipt couldn't be uploaded to Monarch." };

export interface ReceiptFile {
	name: string;
	contentType: 'application/pdf';
	bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Monarch's receipt upload, matching what Transactions → Receipts sends: create a sync per receipt, upload the file to
 * it, then start the sync. Monarch then reads the receipt, matches it to a transaction and splits it.
 */
export class MonarchReceiptsClient {
	public constructor(private readonly client: MonarchClient) {}

	/** At most RECEIPTS_PER_UPLOAD at once, in order; `onStarted` is called for each one Monarch starts processing. */
	public async upload(receipts: ReceiptFile[], onStarted: () => void): Promise<void> {
		if (receipts.length > RECEIPTS_PER_UPLOAD) throw new Error(`Can't upload more than ${RECEIPTS_PER_UPLOAD} receipts at once.`);
		const { createBulkRetailSync } = await this.client.request('wingspan_CreateReceiptSyncs', CREATE_RECEIPT_SYNCS_MUTATION, CreateReceiptSyncsSchema, { input: { count: receipts.length } });
		ensureMutationSucceeded(createBulkRetailSync, UPLOAD_REJECTED);
		const syncIds = createBulkRetailSync?.retailSyncs?.map(sync => sync.id) ?? [];
		if (syncIds.length !== receipts.length) throw new MonarchApiError("Monarch didn't start an upload for every receipt.", false);

		for (const [index, receipt] of receipts.entries()) {
			const syncId = syncIds[index] as string;
			await this.client.postForm(`/retail-sync/${syncId}/files`, this.toFormData(receipt));
			const { startRetailSync } = await this.client.request('wingspan_StartReceiptSync', START_RECEIPT_SYNC_MUTATION, StartReceiptSyncSchema, { syncId });
			ensureMutationSucceeded(startRetailSync, UPLOAD_REJECTED);
			onStarted();
		}
	}

	/** Every receipt and order Monarch has dated `startDate` to `endDate` ("YYYY-MM-DD"), from any source. */
	public async getExistingReceipts(startDate: string, endDate: string): Promise<ExistingReceipt[]> {
		const receipts: ExistingReceipt[] = [];
		let afterCursor: string | null = null;
		for (let page = 0; page < MAX_EXISTING_PAGES; page++) {
			const { retailOrdersConnection }: v.InferOutput<typeof ExistingReceiptsSchema> = await this.client.request('wingspan_GetExistingReceipts', EXISTING_RECEIPTS_QUERY, ExistingReceiptsSchema, {
				filters: { startDate, endDate },
				first: EXISTING_PAGE_SIZE,
				after: afterCursor
			});
			for (const { node } of retailOrdersConnection?.edges ?? []) {
				if (node.merchantName && typeof node.grandTotal === 'number' && node.date) receipts.push({ merchant: node.merchantName, total: node.grandTotal, date: node.date.slice(0, 10) });
			}
			if (!retailOrdersConnection?.pageInfo.hasNextPage || !retailOrdersConnection.pageInfo.endCursor) return receipts;
			afterCursor = retailOrdersConnection.pageInfo.endCursor;
		}
		return receipts;
	}

	private toFormData(receipt: ReceiptFile): FormData {
		const form = new FormData();
		form.append('payloads_count', '1');
		form.append('metadata_0', JSON.stringify({ orderId: crypto.randomUUID(), vendor: 'user_import', payloadType: 'order', contentType: receipt.contentType }));
		form.append('payload_0', new Blob([receipt.bytes], { type: receipt.contentType }), receipt.name);
		return form;
	}
}
