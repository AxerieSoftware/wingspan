import { MonarchAccountType } from '../../../../monarch/api/models/monarchValues';
import { DayPicker } from '../../../../monarch/ui/components/dayPicker';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { MoneyInput, TextInput } from '../../../../monarch/ui/components/input';
import { Select } from '../../../../monarch/ui/components/select';
import type { RecurringItemEditorFieldsProps } from '../../recurringItems/kinds/recurringItemKind';
import type { EditedField } from '../../recurringItems/models/recurringItemDraft';
import type { CardPaymentItem } from '../models/cardPaymentItem';

const NOT_IN_MONARCH = '';

/** `item` is the draft's item, already known to be a card payment. */
export interface CardFieldsProps extends RecurringItemEditorFieldsProps {
	item: CardPaymentItem;
}

/** The card, name and due day, plus payment text and a typical payment for a card not in Monarch. */
export function CardFields({ item, draft, accounts, services, onChange }: CardFieldsProps) {
	const cardAccounts = accounts.filter(account => !account.isAsset && account.type.name === MonarchAccountType.credit && !account.isHidden);
	const cardOptions = [[NOT_IN_MONARCH, 'Not in Monarch'] as const, ...cardAccounts.map(account => [account.id, account.displayName] as const)];
	if (item.accountId && !cardAccounts.some(account => account.id === item.accountId))
		cardOptions.push([item.accountId, cardAccounts.length ? 'Hidden or closed card' : "Couldn't load cards from Monarch"]);

	const changeItem = (editedField: EditedField, patch: Partial<CardPaymentItem>) => onChange({ ...draft, item: { ...item, ...patch } }, editedField);
	// The name follows the selected card unless the user typed their own.
	const pickCard = (accountId: string) => {
		const nameOf = (cardAccountId: string | undefined) => cardAccounts.find(account => account.id === cardAccountId)?.displayName ?? '';
		const isPickedName = !item.name.trim() || item.name === nameOf(item.accountId);
		changeItem('account', { accountId: accountId || undefined, name: accountId && isPickedName ? nameOf(accountId) : item.name });
	};

	return (
		<FormGrid>
			<Field label="Card">
				<Select options={cardOptions} value={item.accountId ?? NOT_IN_MONARCH} onChange={pickCard} />
			</Field>
			<Field label="Name">
				<TextInput value={item.name} placeholder="Rewards card" onChange={name => changeItem('name', { name })} />
			</Field>
			<Field label="Due day">
				<DayPicker
					label="Due day"
					value={draft.schedule.monthDay}
					formatter={services.formatter}
					onChange={monthDay => monthDay && onChange({ ...draft, schedule: services.recurrence.monthly(monthDay) }, 'schedule')}
				/>
			</Field>
			<div />
			{item.accountId ? null : (
				<>
					<Field label="Payment description contains">
						<TextInput
							value={item.matchRule?.matchText ?? ''}
							placeholder="e.g. 4321"
							onChange={matchText => changeItem('matchRule', { matchRule: matchText.trim() ? { matchText, anyAmount: true } : undefined })}
						/>
					</Field>
					<Field label="Typical payment">
						<MoneyInput value={item.amount || null} formatter={services.formatter} onChange={amount => changeItem('amount', { amount: amount ?? 0 })} />
					</Field>
				</>
			)}
		</FormGrid>
	);
}
