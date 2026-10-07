import type { Transaction } from '../../../monarch/api/models/transaction';
import type { Formatter } from '../../../monarch/ui/formatter';
import { EXPENSES_SECTION_NAME, type RecurringItemEditorFieldsProps, type RecurringItemKind } from '../recurringItems/kinds/recurringItemKind';
import type { DetailRow } from '../recurringItems/models/detailRow';
import type { RecurringItem } from '../recurringItems/models/recurringItem';
import type { TransactionPredicate } from '../recurringItems/models/transactionPredicate';
import type { TransactionMatcher } from '../recurringItems/services/transactionMatcher';
import { ManualBillFields } from './components/manualBillFields';
import { MANUAL_BILL_KIND, type ManualBillItem } from './models/manualBillItem';
import type { RecurringItemInferrer } from './services/recurringItemInferrer';

const UNPAID_CARRY_MONTHS = 6;

/** A bill the user adds by hand. It's marked paid when a transaction contains its match text. */
export class ManualBillKind implements RecurringItemKind {
	public readonly kind = MANUAL_BILL_KIND;
	public readonly label = 'Bill';
	public readonly typeColumnLabel = 'Bill';
	public readonly typeSectionName = EXPENSES_SECTION_NAME;
	public readonly paymentWindow = 'afterDueDate';
	public readonly unpaidCarryMonths = UNPAID_CARRY_MONTHS;
	public readonly showsInStatements = false;

	public constructor(
		private readonly matcher: TransactionMatcher,
		private readonly inferrer: RecurringItemInferrer,
		private readonly formatter: Formatter
	) {}

	/** Editor fields for a bill, or nothing for other kinds. */
	public readonly EditorFields = (fieldsProps: RecurringItemEditorFieldsProps) => {
		const { item } = fieldsProps.draft;
		return this.owns(item) ? <ManualBillFields {...fieldsProps} item={item} inferrer={this.inferrer} /> : null;
	};

	public owns(item: RecurringItem): item is ManualBillItem {
		return item.kind === MANUAL_BILL_KIND;
	}

	/** Outflows containing the match text, within 10% or $5 of the bill's amount unless any amount is allowed. */
	public paymentRule(item: RecurringItem): TransactionPredicate | null {
		return this.matcher.predicateFor(item, true);
	}

	/** The matched payment's amount, or the bill's amount while unpaid. */
	public occurrenceAmount(item: RecurringItem, matchedTransaction: Transaction | null): number {
		return matchedTransaction ? Math.abs(matchedTransaction.amount) : item.amount;
	}

	public expectedAmount(item: RecurringItem): number {
		return item.amount;
	}

	/** A bill's amount was set by the user, so it needs no note. */
	public amountNote(): string | null {
		return null;
	}

	public linkedAccountId(): string | undefined {
		return undefined;
	}

	/** Without match text no payment can be found, so the bill would never be marked paid. */
	public problemsWith(item: RecurringItem): string[] {
		const problems: string[] = [];
		if (!(Number.isFinite(item.amount) && item.amount > 0)) problems.push('Amount must be more than $0.');
		if (!item.matchRule?.matchText.trim()) problems.push("Fill in Transaction contains, or pick a payment, so Wingspan can tell when it's paid.");
		return problems;
	}

	public detailRows(item: RecurringItem): DetailRow[] {
		return [
			{ label: 'Amount', value: this.formatter.money(item.amount) },
			{ label: 'Matches', value: this.matcher.describe(item, false) }
		];
	}
}
