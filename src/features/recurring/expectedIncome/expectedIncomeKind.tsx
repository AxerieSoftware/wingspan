import type { Transaction } from '../../../monarch/api/models/transaction';
import type { Formatter } from '../../../monarch/ui/formatter';
import { ManualBillFields } from '../manualBills/components/manualBillFields';
import type { RecurringItemInferrer } from '../manualBills/services/recurringItemInferrer';
import { INCOME_SECTION_NAME, type RecurringItemEditorFieldsProps, type RecurringItemKind } from '../recurringItems/kinds/recurringItemKind';
import type { DetailRow } from '../recurringItems/models/detailRow';
import type { RecurringItem } from '../recurringItems/models/recurringItem';
import type { TransactionPredicate } from '../recurringItems/models/transactionPredicate';
import type { TransactionMatcher } from '../recurringItems/services/transactionMatcher';
import { EXPECTED_INCOME_KIND, type ExpectedIncomeItem } from './models/expectedIncomeItem';

/**
 * Income the user expects, like client payouts that vary from week to week. Its amount is an estimate, so any deposit
 * containing the match text counts as received, and income that didn't arrive isn't carried over as owed.
 */
export class ExpectedIncomeKind implements RecurringItemKind {
	public readonly kind = EXPECTED_INCOME_KIND;
	public readonly label = 'Income';
	public readonly typeColumnLabel = 'Income';
	public readonly typeSectionName = INCOME_SECTION_NAME;
	public readonly moneyFlow = 'inflow';
	public readonly paymentWindow = 'nearDueDate';
	public readonly unpaidCarryMonths = 0;
	public readonly showsInStatements = false;

	public constructor(
		private readonly matcher: TransactionMatcher,
		private readonly inferrer: RecurringItemInferrer,
		private readonly formatter: Formatter
	) {}

	/** Editor fields for income, or nothing for other kinds. */
	public readonly EditorFields = (fieldsProps: RecurringItemEditorFieldsProps) => {
		const { item } = fieldsProps.draft;
		return this.owns(item) ? <ManualBillFields {...fieldsProps} item={item} moneyFlow={this.moneyFlow} inferrer={this.inferrer} /> : null;
	};

	public owns(item: RecurringItem): item is ExpectedIncomeItem {
		return item.kind === EXPECTED_INCOME_KIND;
	}

	public paymentRule(item: RecurringItem): TransactionPredicate | null {
		return this.matcher.predicateFor(item, false, this.moneyFlow);
	}

	/** The deposit's amount once received, or the expected amount until then. */
	public occurrenceAmount(item: RecurringItem, matchedTransaction: Transaction | null): number {
		return matchedTransaction ? matchedTransaction.amount : item.amount;
	}

	public expectedAmount(item: RecurringItem): number {
		return item.amount;
	}

	public amountNote(_item: RecurringItem, received: boolean): string | null {
		return received ? null : 'Expected';
	}

	public linkedAccountId(): string | undefined {
		return undefined;
	}

	public problemsWith(item: RecurringItem): string[] {
		const problems: string[] = [];
		if (!(Number.isFinite(item.amount) && item.amount > 0)) problems.push('Expected amount must be more than $0.');
		if (!item.matchRule?.matchText.trim()) problems.push("Fill in Transaction contains, or pick a deposit, so Wingspan can tell when it's received.");
		return problems;
	}

	public detailRows(item: RecurringItem): DetailRow[] {
		return [
			{ label: 'Expected amount', value: this.formatter.money(item.amount) },
			{ label: 'Matches', value: this.matcher.describe(item, 'never') }
		];
	}
}
