import * as v from 'valibot';
import type { EnteredBalance, LoanBalances } from './models/loanBalances';
import { MonarchAccountType } from './models/monarchValues';
import type { MonarchClient } from './monarchClient';
import { ensureMutationSucceeded, MutationPayloadSchema } from './mutationPayload';

const GET_LOAN_BALANCES_QUERY = `
	query wingspan_GetLoanBalances($startDate: Date, $endDate: Date) {
		accounts {
			id displayName currentBalance type { name } businessEntity { id }
			startBalance: signedBalance(date: $startDate)
			endBalance: signedBalance(date: $endDate)
		}
	}
`;

const GET_BALANCE_SNAPSHOTS_QUERY = `
	query wingspan_GetBalanceSnapshots($accountId: UUID!) {
		snapshotsForAccount(accountId: $accountId) { date signedBalance }
	}
`;

const UPDATE_BALANCE_MUTATION = `
	mutation wingspan_UpdateLoanBalance($input: UpdateAccountMutationInput!) {
		updateAccount(input: $input) {
			account { id }
			errors { message }
		}
	}
`;

const GetLoanBalancesSchema = v.object({
	accounts: v.array(
		v.object({
			id: v.string(),
			displayName: v.string(),
			currentBalance: v.nullish(v.number(), 0),
			type: v.object({ name: v.string() }),
			businessEntity: v.nullish(v.object({ id: v.string() }), null),
			startBalance: v.nullable(v.number()),
			endBalance: v.nullable(v.number())
		})
	)
});
const GetBalanceSnapshotsSchema = v.object({ snapshotsForAccount: v.array(v.object({ date: v.string(), signedBalance: v.number() })) });
const UpdateBalanceSchema = v.object({ updateAccount: MutationPayloadSchema({}) });

/** Reads the household's loan balances, and enters a new balance for a manual loan. */
export class MonarchLoansClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Every loan's balance at the end of each date. */
	public async getLoanBalances(startDate: string, endDate: string): Promise<LoanBalances[]> {
		const { accounts } = await this.client.request('wingspan_GetLoanBalances', GET_LOAN_BALANCES_QUERY, GetLoanBalancesSchema, { startDate, endDate });
		return accounts
			.filter(account => account.type.name === MonarchAccountType.loan)
			.map(({ id, displayName, currentBalance, businessEntity, startBalance, endBalance }) => ({ accountId: id, displayName, currentBalance, businessEntity, startBalance, endBalance }));
	}

	/** Null when Monarch has no balance for the loan. Monarch keeps a balance for every day, so the date is when the latest one first appears. */
	public async tryGetEnteredBalance(accountId: string): Promise<EnteredBalance | null> {
		const { snapshotsForAccount } = await this.client.request('wingspan_GetBalanceSnapshots', GET_BALANCE_SNAPSHOTS_QUERY, GetBalanceSnapshotsSchema, { accountId });
		const snapshots = [...snapshotsForAccount].sort((first, second) => first.date.localeCompare(second.date));
		const latest = snapshots.at(-1);
		if (!latest) return null;

		let enteredDate = latest.date;
		for (const snapshot of [...snapshots].reverse()) {
			if (snapshot.signedBalance !== latest.signedBalance) break;
			enteredDate = snapshot.date;
		}
		return { owed: -latest.signedBalance, date: enteredDate };
	}

	/** Enters what a manual loan owes now, as its balance in Monarch. */
	public async updateBalance(accountId: string, owed: number): Promise<void> {
		const { updateAccount } = await this.client.request('wingspan_UpdateLoanBalance', UPDATE_BALANCE_MUTATION, UpdateBalanceSchema, { input: { id: accountId, displayBalance: owed } });
		ensureMutationSucceeded(updateAccount, { logMessage: "Monarch rejected a loan's new balance.", userMessage: "Monarch couldn't save the balance." });
	}
}
