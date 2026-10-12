import * as v from 'valibot';
import type { LoanBalances } from './models/loanBalances';
import { MonarchAccountType } from './models/monarchValues';
import type { MonarchClient } from './monarchClient';

const GET_LOAN_BALANCES_QUERY = `
	query wingspan_GetLoanBalances($startDate: Date, $endDate: Date) {
		accounts {
			id displayName currentBalance type { name } businessEntity { id }
			startBalance: signedBalance(date: $startDate)
			endBalance: signedBalance(date: $endDate)
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

/** Reads the household's loan balances. */
export class MonarchLoansClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Every loan's balance at the end of each date. */
	public async getLoanBalances(startDate: string, endDate: string): Promise<LoanBalances[]> {
		const { accounts } = await this.client.request('wingspan_GetLoanBalances', GET_LOAN_BALANCES_QUERY, GetLoanBalancesSchema, { startDate, endDate });
		return accounts
			.filter(account => account.type.name === MonarchAccountType.loan)
			.map(({ id, displayName, currentBalance, businessEntity, startBalance, endBalance }) => ({ accountId: id, displayName, currentBalance, businessEntity, startBalance, endBalance }));
	}
}
