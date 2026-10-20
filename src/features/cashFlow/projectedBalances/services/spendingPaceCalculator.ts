import type { Calendar } from '../../../../common/calendar';
import { median } from '../../../../common/statistics';
import { transferOtherSides } from '../../../../common/transferPairs';
import { INCOME_GROUP_TYPES, isTransfer, MonarchRecurringType } from '../../../../monarch/api/models/monarchValues';
import { occurrenceAccountId, type RecurringFlow } from '../../../../monarch/api/models/recurringFlow';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { isInterestCharge } from '../models/cardTerms';
import type { SpendingPace } from '../models/projection';

const PACE_MONTHS = 3;
/** How far a payment can be from a Monarch recurring item's expected amount and date and still be taken as that payment. */
const RECURRING_AMOUNT_TOLERANCE = 0.1;
const RECURRING_DATE_TOLERANCE_DAYS = 7;
/** How far apart the two sides of a transfer between the household's own accounts can post. */
const TRANSFER_PAIR_DAYS = 5;

/**
 * Everyday spending per month by account: the median of recent completed months, with refunds netted in. Recurring
 * payments and interest charges are left out, since the projection adds them on its own. Transfers between checking
 * and the counted cards are left out too, but money checking moves to or from any other account, like savings or a
 * brokerage, is counted, since nothing else in the projection follows it.
 */
export class SpendingPaceCalculator {
	public constructor(private readonly calendar: Calendar) {}

	/**
	 * `spendingAccountIds` are checking and the counted cards. `unassignedAccountIds`: the household's accounts, which a
	 * Monarch recurring item with no account could be paid from.
	 */
	public pace(
		transactions: Transaction[],
		checkingAccountIds: ReadonlySet<string>,
		spendingAccountIds: ReadonlySet<string>,
		recurringTransactionIds: ReadonlySet<string>,
		recurringFlows: RecurringFlow[],
		unassignedAccountIds: ReadonlySet<string>
	): SpendingPace {
		const months = this.completedMonths(transactions);
		const monarchRecurringIds = this.monarchRecurringPayments(transactions, recurringFlows, unassignedAccountIds);
		// A payment Monarch ties to a recurring item that's still projected. One tied to an ended item stays everyday spending.
		const projectedRecurrenceIds = new Set(recurringFlows.filter(flow => flow.recurrenceGroup.recurringType === MonarchRecurringType.expense).map(flow => flow.recurrenceGroup.id));
		const followedTransferIds = this.followedTransferIds(transactions, checkingAccountIds, spendingAccountIds);
		const isEveryday = (transaction: Transaction) =>
			!!transaction.accountId &&
			spendingAccountIds.has(transaction.accountId) &&
			!projectedRecurrenceIds.has(transaction.recurrenceGroupId ?? '') &&
			!transaction.hideFromReports &&
			!recurringTransactionIds.has(transaction.id) &&
			!monarchRecurringIds.has(transaction.id) &&
			!isInterestCharge(transaction) &&
			(!isTransfer(transaction) || (checkingAccountIds.has(transaction.accountId) && !followedTransferIds.has(transaction.id))) &&
			!INCOME_GROUP_TYPES.has(transaction.category?.groupType ?? '');
		const monthSet = new Set(months);
		const everyday = transactions.filter(transaction => monthSet.has(this.calendar.monthOf(transaction.date)) && isEveryday(transaction));
		const firstDateByAccountId = this.firstDateByAccountId(transactions);
		// An account opened partway through is measured only on its full months.
		const monthsOf = (accountId: string) => months.filter(month => month >= this.firstFullMonth(firstDateByAccountId.get(accountId) ?? `${month}-01`));
		const monthlyByAccountId = new Map(
			[...Map.groupBy(everyday, transaction => transaction.accountId as string)].map(([accountId, spending]) => [accountId, this.medianMonthly(spending, monthsOf(accountId))] as const)
		);
		return { monthlyByAccountId };
	}

	/**
	 * Payments to Monarch's recurring expenses that Monarch didn't tie to them, or tied to an item it has since replaced: they're projected on their own days.
	 * Each expected occurrence matches at most one payment, at its merchant from the account it's paid from, near its
	 * date and amount, so other purchases at the same merchant (like groceries at a store where a membership renews)
	 * still count. An occurrence with no account could be paid from any of the household's accounts.
	 */
	private monarchRecurringPayments(transactions: Transaction[], recurringFlows: RecurringFlow[], unassignedAccountIds: ReadonlySet<string>): Set<string> {
		const paymentsByKey = Map.groupBy(
			transactions.filter(transaction => transaction.merchantId && transaction.accountId && transaction.amount < 0),
			transaction => merchantAccountKey(transaction.merchantId as string, transaction.accountId as string)
		);
		const claimedIds = new Set<string>();
		// Later occurrences can't have a posted payment yet.
		const latestMatchableDate = this.calendar.addDays(this.calendar.today(), RECURRING_DATE_TOLERANCE_DAYS);
		for (const flow of recurringFlows) {
			const { recurrenceGroup } = flow;
			const merchantId = recurrenceGroup.merchant?.id;
			if (!merchantId || recurrenceGroup.recurringType !== MonarchRecurringType.expense) continue;
			for (const occurrence of flow.occurrences) {
				if (occurrence.date > latestMatchableDate) continue;
				const expected = Math.abs(occurrence.amount ?? recurrenceGroup.amount ?? 0);
				if (!expected) continue;
				const accountId = occurrenceAccountId(flow, occurrence);
				const daysFrom = (transaction: Transaction) => Math.abs(this.calendar.daysBetween(occurrence.date, transaction.date));
				const amountOff = (transaction: Transaction) => Math.abs(Math.abs(transaction.amount) - expected);
				const [payment] = (accountId ? [accountId] : [...unassignedAccountIds])
					.flatMap(candidateAccountId => paymentsByKey.get(merchantAccountKey(merchantId, candidateAccountId)) ?? [])
					.filter(transaction => !claimedIds.has(transaction.id) && amountOff(transaction) <= expected * RECURRING_AMOUNT_TOLERANCE && daysFrom(transaction) <= RECURRING_DATE_TOLERANCE_DAYS)
					.toSorted((a, b) => daysFrom(a) - daysFrom(b) || amountOff(a) - amountOff(b) || a.id.localeCompare(b.id));
				if (payment) claimedIds.add(payment.id);
			}
		}
		return claimedIds;
	}

	/**
	 * Checking's transfers whose other side is on checking or a counted card, like a card payment, and those other sides:
	 * the projection already follows both.
	 */
	private followedTransferIds(transactions: Transaction[], checkingAccountIds: ReadonlySet<string>, spendingAccountIds: ReadonlySet<string>): Set<string> {
		const checkingTransfers = transactions.filter(transaction => checkingAccountIds.has(transaction.accountId ?? '') && isTransfer(transaction));
		const followed = transactions.filter(transaction => spendingAccountIds.has(transaction.accountId ?? ''));
		const otherSides = transferOtherSides(checkingTransfers, followed, this.calendar, { maxDays: TRANSFER_PAIR_DAYS });
		return new Set([...otherSides].flatMap(([transferId, otherSide]) => [transferId, otherSide.id]));
	}

	/** Up to three months before this one, from the first full month with transactions: recent enough to follow a real change in spending. */
	private completedMonths(transactions: Transaction[]): string[] {
		const currentMonth = this.calendar.currentMonth();
		const firstDate = transactions.reduce((earliest, transaction) => (transaction.date < earliest ? transaction.date : earliest), `${currentMonth}-01`);
		const monthCount = Math.max(0, Math.min(PACE_MONTHS, this.calendar.monthsBetween(this.firstFullMonth(firstDate), currentMonth)));
		return Array.from({ length: monthCount }, (_, index) => this.calendar.addMonths(currentMonth, -(index + 1)));
	}

	/** The first transaction's month if it's on the 1st, otherwise the next month, since a partial month would understate spending. */
	private firstFullMonth(firstDate: string): string {
		const month = this.calendar.monthOf(firstDate);
		return this.calendar.dayOf(firstDate) === 1 ? month : this.calendar.addMonths(month, 1);
	}

	private firstDateByAccountId(transactions: Transaction[]): ReadonlyMap<string, string> {
		const firstDates = new Map<string, string>();
		for (const { accountId, date } of transactions) {
			const firstDate = accountId ? firstDates.get(accountId) : undefined;
			if (accountId && (firstDate === undefined || date < firstDate)) firstDates.set(accountId, date);
		}
		return firstDates;
	}

	/** A month with nothing spent counts as zero. Net refunds never make the pace negative. */
	private medianMonthly(transactions: Transaction[], months: string[]): number {
		const spentByMonth = new Map(months.map(month => [month, 0]));
		for (const transaction of transactions) {
			const spent = spentByMonth.get(this.calendar.monthOf(transaction.date));
			if (spent !== undefined) spentByMonth.set(this.calendar.monthOf(transaction.date), spent - transaction.amount);
		}

		return Math.max(0, median([...spentByMonth.values()]));
	}
}

const merchantAccountKey = (merchantId: string, accountId: string) => `${merchantId}|${accountId}`;
