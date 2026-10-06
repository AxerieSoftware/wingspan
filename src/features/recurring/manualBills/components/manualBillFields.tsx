import { useMemo, useState } from 'react';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { TextInput } from '../../../../monarch/ui/components/input';
import { type MerchantChoice, MerchantSelect } from '../../../../monarch/ui/components/merchantSelect';
import type { RecurringItemEditorFieldsProps } from '../../recurringItems/kinds/recurringItemKind';
import type { ManualBillItem } from '../models/manualBillItem';
import type { RecurringItemInferrer } from '../services/recurringItemInferrer';
import { BillFields } from './billFields';
import { IconPicker } from './iconPicker';
import { MatchSummary } from './matchSummary';
import { TransactionPicker } from './transactionPicker';

/** `item` is the draft's item, already known to be a bill. */
export interface ManualBillFieldsProps extends RecurringItemEditorFieldsProps {
	item: ManualBillItem;
	inferrer: RecurringItemInferrer;
}

/** Bill editor: pick a merchant and past payments, and the other fields are filled in from them unless edited. */
export function ManualBillFields({ item, startItem, draft, editedFields, accounts, transactions, transactionsStatus, services, inferrer, onChange }: ManualBillFieldsProps) {
	const [changedPickedIds, setChangedPickedIds] = useState<ReadonlySet<string> | null>(null);
	const [chosenMerchant, setChosenMerchant] = useState<MerchantChoice | null>(null);
	const [startItemPaymentIds] = useState<ReadonlySet<string>>(
		() => new Set(startItem?.kind === item.kind ? services.payments.matchingTransactions(startItem, transactions).map(transaction => transaction.id) : [])
	);
	const pickedIds = changedPickedIds ?? startItemPaymentIds;
	const pickedTransactions = transactions.filter(transaction => pickedIds.has(transaction.id));
	const merchants = useMemo(() => inferrer.merchantChoices(transactions), [inferrer, transactions]);
	const pickedMerchantName = inferrer.mostCommonMerchantName(pickedTransactions);
	const merchant = chosenMerchant ?? merchants.find(choice => choice.name === pickedMerchantName) ?? null;

	const changePicked = (nextPickedIds: ReadonlySet<string>) => {
		setChangedPickedIds(nextPickedIds);
		const nextPickedTransactions = transactions.filter(transaction => nextPickedIds.has(transaction.id));
		onChange(inferrer.applyTo(draft, nextPickedTransactions, editedFields, !startItem));
	};

	return (
		<>
			<FormGrid>
				<Field label="Merchant">
					<MerchantSelect merchants={merchants} value={merchant} label="Merchant" onChange={setChosenMerchant} />
				</Field>
				<Field label="Name and icon">
					<div className="flex items-start gap-2.5">
						<IconPicker item={item} merchantLogoUrl={merchant?.logoUrl ?? null} onPick={icon => onChange({ ...draft, item: { ...item, icon } }, 'icon')} />
						<TextInput value={item.name} placeholder="Defaults to merchant" onChange={name => onChange({ ...draft, item: { ...item, name } }, 'name')} />
					</div>
				</Field>
			</FormGrid>
			<div className="mt-lg flex flex-col gap-xs">
				<span data-mds="text" className="text-sm font-book text-content-secondary">
					Select the payments that belong to this bill.
				</span>
				<TransactionPicker
					transactions={transactions}
					status={transactionsStatus}
					accounts={accounts}
					pickedIds={pickedIds}
					merchantName={merchant?.name ?? null}
					services={services}
					matchCard={pickedTransactions.length ? <MatchSummary draft={draft} pickedTransactions={pickedTransactions} services={services} /> : null}
					onChange={changePicked}
				/>
			</div>
			<BillFields item={item} draft={draft} accounts={accounts} services={services} onChange={onChange} />
		</>
	);
}
