import * as v from 'valibot';
import { logError } from '../../common/log';
import type { Account, AccountNotes, AccountSummary, CreateManualAccountInput, UpdateAccountInput } from './models/account';
import type { BusinessEntity } from './models/businessEntity';
import { MonarchApiError } from './monarchApiError';
import type { MonarchClient } from './monarchClient';

const GET_ACCOUNT_SUMMARIES_QUERY = `
	query wingspan_GetAccountSummaries {
		accounts { id displayName isHidden type { name } }
	}
`;

const GET_ACCOUNTS_QUERY = `
	query wingspan_GetAccounts {
		accounts { id displayName logoUrl currentBalance isAsset isHidden apr interestRate limit dataProviderCreditLimit minimumPayment type { name display } businessEntity { id } }
	}
`;

const GET_BUSINESS_ENTITIES_QUERY = `
	query wingspan_GetBusinessEntities {
		subscription { id entitlements }
		businessEntities { id name logoUrl color }
	}
`;

const GET_ACCOUNT_NOTES_QUERY = `
	query wingspan_GetAccountNotes($id: UUID!) {
		account(id: $id) { id notes deletedAt }
	}
`;

const CREATE_MANUAL_ACCOUNT_MUTATION = `
	mutation wingspan_CreateManualAccount($input: CreateManualAccountMutationInput!) {
		createManualAccount(input: $input) {
			account { id }
			errors { message }
		}
	}
`;

const UPDATE_ACCOUNT_MUTATION = `
	mutation wingspan_UpdateAccount($input: UpdateAccountMutationInput!) {
		updateAccount(input: $input) {
			account { id }
			errors { message }
		}
	}
`;

const DELETE_ACCOUNT_MUTATION = `
	mutation wingspan_DeleteAccount($id: UUID!) {
		deleteAccount(id: $id) {
			deleted
			errors { message }
		}
	}
`;

const MutationErrorsSchema = v.nullish(v.object({ message: v.nullish(v.string()) }));
const MutationPayloadSchema = <TEntries extends v.ObjectEntries>(entries: TEntries) => v.nullish(v.object({ ...entries, errors: MutationErrorsSchema }));

const AccountSummarySchema = v.object({ id: v.string(), displayName: v.string(), isHidden: v.boolean(), type: v.object({ name: v.string() }) });

const AccountSchema = v.object({
	id: v.string(),
	displayName: v.string(),
	logoUrl: v.nullish(v.string()),
	currentBalance: v.nullable(v.number()),
	isAsset: v.boolean(),
	isHidden: v.boolean(),
	type: v.object({ name: v.string(), display: v.string() }),
	apr: v.nullish(v.number()),
	interestRate: v.nullish(v.number()),
	limit: v.nullish(v.number()),
	dataProviderCreditLimit: v.nullish(v.number()),
	minimumPayment: v.nullish(v.number()),
	businessEntity: v.nullish(v.object({ id: v.string() }))
});

// Strict: skipping an entry could hide Wingspan's own account, making it look deleted.
const GetAccountSummariesSchema = v.object({ accounts: v.array(AccountSummarySchema) });
// Also strict: a missing card or checking account would silently change the amounts shown.
const GetAccountsSchema = v.object({ accounts: v.array(AccountSchema) });
/** Businesses require Monarch's Plus plan or a Plus trial. */
const BUSINESS_ENTITLEMENTS = ['premium_plus', 'premium_plus_trial'];
const GetBusinessEntitiesSchema = v.object({
	subscription: v.nullish(v.object({ entitlements: v.nullish(v.array(v.string()), []) })),
	businessEntities: v.array(v.object({ id: v.string(), name: v.string(), logoUrl: v.nullish(v.string(), null), color: v.nullish(v.string(), null) }))
});
const GetAccountNotesSchema = v.object({ account: v.nullable(v.object({ id: v.string(), notes: v.nullable(v.string()), deletedAt: v.nullable(v.string()) })) });
const CreateManualAccountSchema = v.object({ createManualAccount: MutationPayloadSchema({ account: v.nullish(v.object({ id: v.string() })) }) });
const UpdateAccountSchema = v.object({ updateAccount: MutationPayloadSchema({}) });
const DeleteAccountSchema = v.object({ deleteAccount: MutationPayloadSchema({ deleted: v.nullish(v.boolean()) }) });

/** Reads the household's accounts and businesses, and creates, updates and deletes Wingspan's own account. */
export class MonarchAccountsClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Every account, hidden ones too, with just enough to find Wingspan's own. */
	public async getAccountSummaries(): Promise<AccountSummary[]> {
		const { accounts } = await this.client.request('wingspan_GetAccountSummaries', GET_ACCOUNT_SUMMARIES_QUERY, GetAccountSummariesSchema);
		return accounts;
	}

	/** Every account, hidden ones too, with its balance, limits and business. */
	public async getAccounts(): Promise<Account[]> {
		const { accounts } = await this.client.request('wingspan_GetAccounts', GET_ACCOUNTS_QUERY, GetAccountsSchema);
		return accounts;
	}

	/** Empty without Monarch's Plus plan, which Monarch's business filter requires, so Wingspan's filter only shows where Monarch's would. */
	public async getBusinessEntities(): Promise<BusinessEntity[]> {
		const { subscription, businessEntities } = await this.client.request('wingspan_GetBusinessEntities', GET_BUSINESS_ENTITIES_QUERY, GetBusinessEntitiesSchema);
		const hasBusinessAccess = subscription?.entitlements?.some(entitlement => BUSINESS_ENTITLEMENTS.includes(entitlement)) ?? false;
		return hasBusinessAccess ? businessEntities : [];
	}

	/** Null when the account is gone. Monarch's deletes are soft, so a deleted account still loads with `deletedAt` set. */
	public async getAccountNotes(accountId: string): Promise<AccountNotes | null> {
		const { account } = await this.client.request('wingspan_GetAccountNotes', GET_ACCOUNT_NOTES_QUERY, GetAccountNotesSchema, { id: accountId });
		if (!account || account.deletedAt) return null;
		return { notes: account.notes };
	}

	/** Returns the new account's id. */
	public async createManualAccount(input: CreateManualAccountInput): Promise<string> {
		const { createManualAccount } = await this.client.request('wingspan_CreateManualAccount', CREATE_MANUAL_ACCOUNT_MUTATION, CreateManualAccountSchema, { input });
		this.ensureSucceeded(createManualAccount);

		const accountId = createManualAccount?.account?.id;
		if (!accountId) throw new MonarchApiError("Monarch didn't return the new account.", false);
		return accountId;
	}

	public async updateAccount(input: UpdateAccountInput): Promise<void> {
		const { updateAccount } = await this.client.request('wingspan_UpdateAccount', UPDATE_ACCOUNT_MUTATION, UpdateAccountSchema, { input });
		this.ensureSucceeded(updateAccount);
	}

	/** Throws unless Monarch says the account is deleted. */
	public async deleteAccount(accountId: string): Promise<void> {
		const { deleteAccount } = await this.client.request('wingspan_DeleteAccount', DELETE_ACCOUNT_MUTATION, DeleteAccountSchema, { id: accountId });
		this.ensureSucceeded(deleteAccount);
		if (deleteAccount?.deleted === false) throw new MonarchApiError("Monarch didn't delete the account.", false);
	}

	/** Any error means the change failed, whether or not it has a message. */
	private ensureSucceeded(payload: { errors?: { message?: string | null } | null } | null | undefined): void {
		if (!payload?.errors) return;
		// Monarch's error message isn't logged, since it can include the household data that was sent.
		logError(new Error("Monarch rejected a change to Wingspan's account."));
		throw new MonarchApiError("Monarch couldn't save the change.", false);
	}
}
