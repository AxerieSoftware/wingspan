import { MonarchAccountType } from '../../../../monarch/api/models/monarchValues';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { Select } from '../../../../monarch/ui/components/select';
import { ManualBillFields } from '../../manualBills/components/manualBillFields';
import type { RecurringItemInferrer } from '../../manualBills/services/recurringItemInferrer';
import type { RecurringItemEditorFieldsProps } from '../../recurringItems/kinds/recurringItemKind';
import type { LoanPaymentItem } from '../models/loanPaymentItem';

const NO_LOAN = '';

/** `item` is the draft's item, already known to be a loan payment. */
export interface LoanPaymentFieldsProps extends RecurringItemEditorFieldsProps {
	item: LoanPaymentItem;
	inferrer: RecurringItemInferrer;
}

/** The loan it pays toward, then a bill's fields: the payment, how much and when. */
export function LoanPaymentFields(fieldsProps: LoanPaymentFieldsProps) {
	const { item, draft, accounts, onChange, inferrer } = fieldsProps;
	const loanAccounts = accounts.filter(account => account.type.name === MonarchAccountType.loan && !account.isHidden);
	const loanOptions = [[NO_LOAN, 'Choose a loan'] as const, ...loanAccounts.map(account => [account.id, account.displayName] as const)];
	if (item.loanAccountId && !loanAccounts.some(account => account.id === item.loanAccountId))
		loanOptions.push([item.loanAccountId, loanAccounts.length ? 'Hidden or closed loan' : "Couldn't load loans from Monarch"]);

	// The name follows the selected loan unless the user typed their own.
	const pickLoan = (accountId: string) => {
		const nameOf = (loanAccountId: string | undefined) => loanAccounts.find(account => account.id === loanAccountId)?.displayName ?? '';
		const isPickedName = !item.name.trim() || item.name === nameOf(item.loanAccountId);
		const changedItem: LoanPaymentItem = { ...item, loanAccountId: accountId || undefined, name: accountId && isPickedName ? nameOf(accountId) : item.name };
		onChange({ ...draft, item: changedItem }, 'account');
	};

	return (
		<div className="flex flex-col gap-default">
			<FormGrid>
				<Field label="Loan">
					<Select options={loanOptions} value={item.loanAccountId ?? NO_LOAN} onChange={pickLoan} />
				</Field>
			</FormGrid>
			<ManualBillFields {...fieldsProps} moneyFlow="outflow" inferrer={inferrer} />
		</div>
	);
}
