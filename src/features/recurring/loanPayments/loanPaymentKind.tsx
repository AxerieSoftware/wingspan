import type { Transaction } from '../../../monarch/api/models/transaction';
import type { ManualBillKind } from '../manualBills/manualBillKind';
import type { RecurringItemInferrer } from '../manualBills/services/recurringItemInferrer';
import type { RecurringItemEditorFieldsProps, RecurringItemKind } from '../recurringItems/kinds/recurringItemKind';
import type { DetailRow } from '../recurringItems/models/detailRow';
import type { RecurringItem } from '../recurringItems/models/recurringItem';
import type { TransactionPredicate } from '../recurringItems/models/transactionPredicate';
import { LoanPaymentFields } from './components/loanPaymentFields';
import { LOAN_PAYMENT_KIND, type LoanPaymentItem } from './models/loanPaymentItem';

/** A loan's monthly payment: a bill, found and owed by the bill's rules, tied to the loan so its page can estimate the balance. */
export class LoanPaymentKind implements RecurringItemKind {
	public readonly kind = LOAN_PAYMENT_KIND;
	public readonly label = 'Loan payment';
	public readonly typeColumnLabel = 'Loan';
	public readonly typeSectionName: string;
	public readonly moneyFlow = 'outflow';
	public readonly paymentWindow: RecurringItemKind['paymentWindow'];
	public readonly unpaidCarryMonths: number;
	public readonly showsInStatements = false;

	public constructor(
		private readonly bills: ManualBillKind,
		private readonly inferrer: RecurringItemInferrer
	) {
		this.typeSectionName = bills.typeSectionName;
		this.paymentWindow = bills.paymentWindow;
		this.unpaidCarryMonths = bills.unpaidCarryMonths;
	}

	/** Editor fields for a loan payment, or nothing for other kinds. */
	public readonly EditorFields = (fieldsProps: RecurringItemEditorFieldsProps) => {
		const { item } = fieldsProps.draft;
		return this.owns(item) ? <LoanPaymentFields {...fieldsProps} item={item} inferrer={this.inferrer} /> : null;
	};

	public owns(item: RecurringItem): item is LoanPaymentItem {
		return item.kind === LOAN_PAYMENT_KIND;
	}

	public paymentRule(item: RecurringItem): TransactionPredicate | null {
		return this.bills.paymentRule(item);
	}

	public occurrenceAmount(item: RecurringItem, matchedTransaction: Transaction | null): number {
		return this.bills.occurrenceAmount(item, matchedTransaction);
	}

	public expectedAmount(item: RecurringItem): number {
		return this.bills.expectedAmount(item);
	}

	public amountNote(): string | null {
		return this.bills.amountNote();
	}

	/** It owes its own amount, never the loan's balance, so it isn't linked to the loan's account. */
	public linkedAccountId(): string | undefined {
		return undefined;
	}

	public problemsWith(item: RecurringItem): string[] {
		const loanProblems = this.owns(item) && !item.loanAccountId ? ['Choose the loan this payment goes toward.'] : [];
		return [...loanProblems, ...this.bills.problemsWith(item)];
	}

	public detailRows(item: RecurringItem, accountNames: ReadonlyMap<string, string>): DetailRow[] {
		const loanAccountId = this.owns(item) ? item.loanAccountId : undefined;
		return [{ label: 'Loan', value: (loanAccountId && accountNames.get(loanAccountId)) ?? 'Hidden or closed loan' }, ...this.bills.detailRows(item)];
	}
}
