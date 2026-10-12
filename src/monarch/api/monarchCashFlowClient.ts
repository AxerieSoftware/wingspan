import * as v from 'valibot';
import type { IncomeRequest } from './models/incomeRequest';
import type { MonarchClient } from './monarchClient';

const GET_INCOME_QUERY = `
	query wingspan_GetIncome($filters: TransactionFilterInput) {
		aggregates(filters: $filters, fillEmptyValues: true) { summary { sumIncome } }
	}
`;

const GetIncomeSchema = v.object({ aggregates: v.array(v.object({ summary: v.object({ sumIncome: v.nullish(v.number(), 0) }) })) });

/** Reads the totals behind Monarch's Cash Flow that Wingspan's cards compare against. */
export class MonarchCashFlowClient {
	public constructor(private readonly client: MonarchClient) {}

	/** The income Monarch totals for those dates and entities, as Cash Flow's Income card shows it. */
	public async getIncome({ startDate, endDate, businessEntitySet }: IncomeRequest): Promise<number> {
		const { aggregates } = await this.client.request('wingspan_GetIncome', GET_INCOME_QUERY, GetIncomeSchema, {
			filters: { startDate, endDate, ...(businessEntitySet ? { businessEntitySet } : {}) }
		});
		return aggregates[0]?.summary.sumIncome ?? 0;
	}
}
