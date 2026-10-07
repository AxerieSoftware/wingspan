import type { ComponentType } from 'react';
import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import type { Account } from '../../../../monarch/api/models/account';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { DetailRow } from '../models/detailRow';
import type { RecurringItem } from '../models/recurringItem';
import type { EditedField, RecurringItemDraft } from '../models/recurringItemDraft';
import type { TransactionPredicate } from '../models/transactionPredicate';
import type { RecurringItemServices } from '../services/recurringItemServices';

/** A card payment is paid near its due date; a manual bill can be paid any time after, no matter how late. */
export type PaymentWindow = 'nearDueDate' | 'afterDueDate';

/** Load state of Monarch's transactions. */
export type TransactionsStatus = 'loading' | 'failed' | 'ready';

/** What a kind's editor fields get. `startItem` is the saved item being edited, null for a new one. */
export interface RecurringItemEditorFieldsProps {
	startItem: RecurringItem | null;
	draft: RecurringItemDraft;
	editedFields: ReadonlySet<EditedField>;
	accounts: Account[];
	transactions: Transaction[];
	transactionsStatus: TransactionsStatus;
	services: RecurringItemServices;
	onChange(draft: RecurringItemDraft, editedField?: EditedField): void;
}

/** Monarch's Expenses section. Wingspan's items are added to it when Recurring is grouped by type. */
export const EXPENSES_SECTION_NAME = 'Expenses';

/** A kind of item Wingspan adds to Recurring: how it's edited, how its payments are found, and what it owes. */
export interface RecurringItemKind {
	readonly kind: string;
	/** Label for the Type field in Add recurring and the Type row in the item's details. */
	readonly label: string;
	readonly typeColumnLabel: string;
	/** The section its rows go in when Recurring is grouped by type. */
	readonly typeSectionName: string;
	readonly paymentWindow: PaymentWindow;
	/** How many months an unpaid occurrence is carried over before it's dropped. */
	readonly unpaidCarryMonths: number;
	readonly showsInStatements: boolean;
	readonly EditorFields: ComponentType<RecurringItemEditorFieldsProps>;
	owns(item: RecurringItem): boolean;
	paymentRule(item: RecurringItem): TransactionPredicate | null;
	/** The payments the rule found, minus any that were returned, for kinds whose payments can be returned. */
	paymentsThatStood?(item: RecurringItem, payments: Transaction[], transactions: Transaction[]): Transaction[];
	occurrenceAmount(item: RecurringItem, matchedTransaction: Transaction | null, owedByAccountId: BalancesByAccountId): number;
	expectedAmount(item: RecurringItem, owedByAccountId: BalancesByAccountId): number;
	amountNote(item: RecurringItem, paid: boolean): string | null;
	/** Whether the amount owed is unknown, so it's counted as unknown instead of $0. */
	isAmountUnknown?(item: RecurringItem, owedByAccountId: BalancesByAccountId): boolean;
	/** The Monarch account an item is linked to, like a card payment's card. The item owes that account's balance. */
	linkedAccountId(item: RecurringItem): string | undefined;
	problemsWith(item: RecurringItem): string[];
	detailRows(item: RecurringItem, accountNames: ReadonlyMap<string, string>): DetailRow[];
}
