import { CENT_TOLERANCE } from '../../../common/money';
import type { BalancesByAccountId } from '../../../data/models/balancesByAccountId';
import { TRANSFER_GROUP_TYPES } from '../../../monarch/api/models/monarchValues';
import type { Transaction } from '../../../monarch/api/models/transaction';
import { EXPENSES_SECTION_NAME, type RecurringItemEditorFieldsProps, type RecurringItemKind } from '../recurringItems/kinds/recurringItemKind';
import type { DetailRow } from '../recurringItems/models/detailRow';
import type { RecurringItem } from '../recurringItems/models/recurringItem';
import type { TransactionPredicate } from '../recurringItems/models/transactionPredicate';
import type { TransactionMatcher } from '../recurringItems/services/transactionMatcher';
import { CardFields } from './components/cardFields';
import { CARD_PAYMENT_KIND, type CardPaymentItem } from './models/cardPaymentItem';

const PAYMENT_DESCRIPTION_PATTERN = /payment|autopay|thank you/i;
const FEE_DESCRIPTION_PATTERN = /fee|interest/i;
/** How many days after a payment the bank can return it, e.g. for insufficient funds. */
const RETURNED_PAYMENT_DAYS = 10;

/** A credit card payment. It owes the card's balance in Monarch and is shown in the Statements table. */
export class CardPaymentKind implements RecurringItemKind {
	public readonly kind = CARD_PAYMENT_KIND;
	public readonly label = 'Card payment';
	public readonly typeColumnLabel = 'Card payment';
	public readonly typeSectionName = EXPENSES_SECTION_NAME;
	public readonly moneyFlow = 'outflow';
	public readonly paymentWindow = 'nearDueDate';
	/** A statement due late last month that's still unpaid is carried over into this month. */
	public readonly unpaidCarryMonths = 1;
	public readonly showsInStatements = true;

	public constructor(private readonly matcher: TransactionMatcher) {}

	/** Editor fields for a card payment, or nothing for other kinds. */
	public readonly EditorFields = (fieldsProps: RecurringItemEditorFieldsProps) => {
		const { item } = fieldsProps.draft;
		return this.owns(item) ? <CardFields {...fieldsProps} item={item} /> : null;
	};

	public owns(item: RecurringItem): item is CardPaymentItem {
		return item.kind === CARD_PAYMENT_KIND;
	}

	/** An inflow to the card that's a transfer or described as a payment, so refunds don't count; a card not in Monarch matches by description. */
	public paymentRule(item: RecurringItem): TransactionPredicate | null {
		const cardAccountId = this.owns(item) ? item.accountId : undefined;
		if (cardAccountId) return transaction => this.isPaymentToCard(transaction, cardAccountId);
		return this.matcher.predicateFor(item, false, this.moneyFlow);
	}

	/** A payment the bank returned within a few days (e.g. for insufficient funds) doesn't count as paid. */
	public paymentsThatStood(item: RecurringItem, payments: Transaction[], transactions: Transaction[]): Transaction[] {
		const cardAccountId = this.owns(item) ? item.accountId : undefined;
		if (!cardAccountId) return payments;
		const { paymentIds } = this.returnedPayments(cardAccountId, transactions);
		return payments.filter(payment => !paymentIds.has(payment.id));
	}

	/** Card payments the bank returned, each paired with its reversal. Only matched pairs count, so a fee that looks like a reversal stays a charge. */
	public returnedPayments(cardAccountId: string, transactions: Transaction[]): { paymentIds: ReadonlySet<string>; returnIds: ReadonlySet<string> } {
		const payments = transactions.filter(transaction => this.isPaymentToCard(transaction, cardAccountId));
		const paymentIds = new Set<string>();
		const returnIds = new Set<string>();
		// Pair each reversal with the closest eligible payment before it.
		for (const sentBack of transactions.filter(transaction => this.isReturnedPayment(transaction, cardAccountId))) {
			const daysBefore = (payment: Transaction) => Temporal.PlainDate.from(sentBack.date).since(payment.date).days;
			const returned = payments
				.filter(payment => !paymentIds.has(payment.id) && Math.abs(sentBack.amount + payment.amount) < CENT_TOLERANCE && daysBefore(payment) >= 0 && daysBefore(payment) <= RETURNED_PAYMENT_DAYS)
				.sort((a, b) => daysBefore(a) - daysBefore(b))[0];
			if (!returned) continue;
			paymentIds.add(returned.id);
			returnIds.add(sentBack.id);
		}
		return { paymentIds, returnIds };
	}

	/** A returned card payment: a charge on the card that's categorized as a transfer or described as a payment. */
	public isReturnedPayment(transaction: Transaction, cardAccountId: string): boolean {
		return (
			transaction.accountId === cardAccountId &&
			transaction.amount < 0 &&
			// Late fees, returned payment fees and interest are always charges, whatever the description says.
			!FEE_DESCRIPTION_PATTERN.test(transaction.description) &&
			(TRANSFER_GROUP_TYPES.has(transaction.category?.groupType ?? '') || PAYMENT_DESCRIPTION_PATTERN.test(transaction.description))
		);
	}

	/** An inflow described as a payment, not just categorized as a transfer, since Monarch could categorize a refund as a transfer. */
	public isDescribedAsPayment(transaction: Transaction): boolean {
		return PAYMENT_DESCRIPTION_PATTERN.test(transaction.description);
	}

	/** An inflow on the card that's categorized as a transfer or described as a payment. */
	public isPaymentToCard(transaction: Transaction, cardAccountId: string): boolean {
		return (
			transaction.accountId === cardAccountId &&
			transaction.amount > 0 &&
			(TRANSFER_GROUP_TYPES.has(transaction.category?.groupType ?? '') || PAYMENT_DESCRIPTION_PATTERN.test(transaction.description))
		);
	}

	/** The balance Monarch reports for the item's card, or undefined for a card not in Monarch. */
	public owedOnCard(item: RecurringItem, owedByAccountId: BalancesByAccountId): number | undefined {
		return this.owns(item) && item.accountId ? owedByAccountId[item.accountId] : undefined;
	}

	/** A card with a credit balance owes nothing. */
	public occurrenceAmount(item: RecurringItem, matchedTransaction: Transaction | null, owedByAccountId: BalancesByAccountId): number {
		if (matchedTransaction) return Math.abs(matchedTransaction.amount);
		return Math.max(0, this.owedOnCard(item, owedByAccountId) ?? item.amount);
	}

	/** The typical payment, or what's owed on the card when there's none. */
	public expectedAmount(item: RecurringItem, owedByAccountId: BalancesByAccountId): number {
		return item.amount || Math.max(0, this.owedOnCard(item, owedByAccountId) ?? 0);
	}

	/** Where an unpaid amount came from: the card's balance, or the typical payment for a card not in Monarch. */
	public amountNote(item: RecurringItem, paid: boolean): string | null {
		if (paid) return null;
		return this.owns(item) && item.accountId ? 'Balance' : 'Typical';
	}

	/** True when there's no Monarch balance for the card and no typical payment, so the amount owed is unknown. */
	public isAmountUnknown(item: RecurringItem, owedByAccountId: BalancesByAccountId): boolean {
		return this.owns(item) && !item.amount && this.owedOnCard(item, owedByAccountId) === undefined;
	}

	public linkedAccountId(item: RecurringItem): string | undefined {
		return this.owns(item) ? item.accountId : undefined;
	}

	/** A card payment needs its card, or payment text to match when the card isn't in Monarch. */
	public problemsWith(item: RecurringItem): string[] {
		const hasCardAccount = this.owns(item) && !!item.accountId;
		if (hasCardAccount || item.matchRule?.matchText.trim()) return [];
		return ["Choose the card, or if it isn't in Monarch, fill in Payment description contains."];
	}

	public detailRows(item: RecurringItem, accountNames: ReadonlyMap<string, string>): DetailRow[] {
		const cardAccountId = this.owns(item) ? item.accountId : undefined;
		return [
			{ label: 'Card', value: cardAccountId ? (accountNames.get(cardAccountId) ?? 'Linked card') : 'Not in Monarch' },
			{ label: 'Matches', value: cardAccountId ? 'Payments to the card' : this.matcher.describe(item, 'always') }
		];
	}
}
