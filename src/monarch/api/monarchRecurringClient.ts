import * as v from 'valibot';
import type { RecurrenceGroupAccount } from './models/recurrenceGroupAccount';
import type { RecurrenceGroupPeriod } from './models/recurrenceGroupPeriod';
import { paidFromAccountIds, type RecurringFlow } from './models/recurringFlow';
import type { RecurringSummary } from './models/recurringSummary';
import type { MonarchClient } from './monarchClient';

const GET_RECURRENCE_GROUPS_QUERY = `
	query wingspan_GetRecurrenceGroups($startDate: Date, $endDate: Date) {
		recurrenceGroupsForPeriod(includeInactive: false, startDate: $startDate, endDate: $endDate, filters: {}) {
			status date nextDate
			occurrences { date status }
			recurrenceGroup { id name frequency isActive }
		}
	}
`;

const GET_RECURRING_FLOWS_QUERY = `
	query wingspan_GetRecurringFlows($startDate: Date, $endDate: Date) {
		recurrenceGroupsForPeriod(includeInactive: false, startDate: $startDate, endDate: $endDate, filters: {}) {
			occurrences { date status amount account { id } }
			recurrenceGroup { id name recurringType amount account { id } merchant { id } }
		}
	}
`;

const GET_RECURRENCE_GROUP_ACCOUNTS_QUERY = `
	query wingspan_GetRecurrenceGroupAccounts($startDate: Date, $endDate: Date) {
		recurrenceGroupsForPeriod(includeInactive: true, startDate: $startDate, endDate: $endDate, filters: {}) {
			occurrences { account { id } }
			recurrenceGroup { id name isActive recurringType amount account { id } }
		}
	}
`;

const GET_RECURRING_SUMMARY_QUERY = `
	query wingspan_GetRecurringSummary($startDate: Date!, $endDate: Date!, $filters: RecurrenceGroupFilter) {
		aggregatedRecurrenceGroups(startDate: $startDate, endDate: $endDate, filters: $filters, includeInactive: true) {
			expense { completed remaining total }
			income { completed remaining total }
		}
	}
`;

const AccountReferenceSchema = v.nullish(v.object({ id: v.string() }), null);

const RecurrenceGroupsSchema = v.object({
	recurrenceGroupsForPeriod: v.array(
		v.object({
			status: v.string(),
			date: v.nullish(v.string(), null),
			nextDate: v.nullish(v.string(), null),
			occurrences: v.array(v.object({ date: v.string(), status: v.string() })),
			recurrenceGroup: v.object({ id: v.string(), name: v.nullish(v.string(), ''), frequency: v.nullish(v.string(), ''), isActive: v.nullish(v.boolean(), true) })
		})
	)
});

const RecurringFlowsSchema = v.object({
	recurrenceGroupsForPeriod: v.array(
		v.object({
			occurrences: v.array(v.object({ date: v.string(), status: v.string(), amount: v.nullish(v.number(), null), account: AccountReferenceSchema })),
			recurrenceGroup: v.object({
				id: v.string(),
				name: v.nullish(v.string(), ''),
				// A group without a type is neither income nor an expense, so the projection leaves it out.
				recurringType: v.nullish(v.string(), ''),
				amount: v.nullish(v.number(), null),
				account: AccountReferenceSchema,
				merchant: v.nullish(v.object({ id: v.string() }), null)
			})
		})
	)
});

const RecurrenceGroupAccountsSchema = v.object({
	recurrenceGroupsForPeriod: v.array(
		v.object({
			occurrences: v.nullish(v.array(v.object({ account: AccountReferenceSchema })), []),
			recurrenceGroup: v.object({
				id: v.string(),
				name: v.nullish(v.string(), ''),
				isActive: v.nullish(v.boolean(), true),
				recurringType: v.nullish(v.string(), ''),
				amount: v.nullish(v.number(), null),
				account: AccountReferenceSchema
			})
		})
	)
});

const SummaryLineSchema = v.nullish(v.object({ completed: v.nullish(v.number(), 0), remaining: v.nullish(v.number(), 0), total: v.nullish(v.number(), 0) }), { completed: 0, remaining: 0, total: 0 });
const RecurringSummarySchema = v.object({ aggregatedRecurrenceGroups: v.object({ expense: SummaryLineSchema, income: SummaryLineSchema }) });

export class MonarchRecurringClient {
	public constructor(private readonly client: MonarchClient) {}

	/** Active recurring items in the period, with each occurrence's date and status. */
	public async getRecurrenceGroups(startDate: string, endDate: string): Promise<RecurrenceGroupPeriod[]> {
		const { recurrenceGroupsForPeriod } = await this.client.request('wingspan_GetRecurrenceGroups', GET_RECURRENCE_GROUPS_QUERY, RecurrenceGroupsSchema, { startDate, endDate });
		return recurrenceGroupsForPeriod;
	}

	/** Every recurring item in the period, inactive ones too, with the account it's on. */
	public async getRecurrenceGroupAccounts(startDate: string, endDate: string): Promise<RecurrenceGroupAccount[]> {
		const { recurrenceGroupsForPeriod } = await this.client.request('wingspan_GetRecurrenceGroupAccounts', GET_RECURRENCE_GROUP_ACCOUNTS_QUERY, RecurrenceGroupAccountsSchema, { startDate, endDate });
		return recurrenceGroupsForPeriod.map(({ occurrences, recurrenceGroup: { account, ...group } }) => ({
			...group,
			accountIds: paidFromAccountIds({ recurrenceGroup: { account }, occurrences }).map(accountId => accountId ?? null)
		}));
	}

	/** With no accounts, returns every item; otherwise only items on those accounts, the same request Monarch's Filters > Account makes. */
	public async getRecurringSummary(startDate: string, endDate: string, accountIds?: string[]): Promise<RecurringSummary> {
		const filters = accountIds ? { filters: { accounts: accountIds } } : {};
		const { aggregatedRecurrenceGroups } = await this.client.request('wingspan_GetRecurringSummary', GET_RECURRING_SUMMARY_QUERY, RecurringSummarySchema, { startDate, endDate, ...filters });
		return aggregatedRecurrenceGroups;
	}

	/** Active recurring items in the period, with each occurrence's amount and account. */
	public async getRecurringFlows(startDate: string, endDate: string): Promise<RecurringFlow[]> {
		const { recurrenceGroupsForPeriod } = await this.client.request('wingspan_GetRecurringFlows', GET_RECURRING_FLOWS_QUERY, RecurringFlowsSchema, { startDate, endDate });
		return recurrenceGroupsForPeriod;
	}
}
