import { roundToCents } from '../../../../common/money';
import { median } from '../../../../common/statistics';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { MerchantChoice } from '../../../../monarch/ui/components/merchantSelect';
import type { MerchantContainsMatchRule, RecurringItemIcon } from '../../recurringItems/models/recurringItem';
import type { EditedField, RecurringItemDraft } from '../../recurringItems/models/recurringItemDraft';
import type { Schedule } from '../../recurringItems/models/schedule';
import type { RecurrenceCalculator } from '../../recurringItems/services/recurrenceCalculator';

const MIN_COMMON_TEXT_LENGTH = 3;
const VARYING_AMOUNT_RATIO = 1.1;

interface InferredDetails {
	name?: string;
	amount?: number;
	schedule?: Schedule;
	matchRule?: MerchantContainsMatchRule;
	icon?: RecurringItemIcon;
}

/** Fills in a bill's draft from the payments picked for it. */
export class RecurringItemInferrer {
	public constructor(private readonly recurrence: RecurrenceCalculator) {}

	/** Doesn't overwrite fields the user edited, or a saved item's existing name. */
	public applyTo(draft: RecurringItemDraft, pickedTransactions: Transaction[], editedFields: ReadonlySet<EditedField>, isNew: boolean): RecurringItemDraft {
		const inferred = this.inferFrom(pickedTransactions);
		const item = { ...draft.item };
		let schedule = draft.schedule;

		if (inferred.schedule && !editedFields.has('schedule')) schedule = inferred.schedule;
		if (inferred.amount && !editedFields.has('amount')) item.amount = inferred.amount;
		if (inferred.name && !editedFields.has('name') && (isNew || !item.name)) item.name = inferred.name;
		if (inferred.matchRule?.matchText && !editedFields.has('matchRule')) item.matchRule = { ...inferred.matchRule };
		if (inferred.icon && !editedFields.has('icon')) item.icon = inferred.icon;

		return { item, schedule };
	}

	/** Most used first. */
	public merchantChoices(transactions: Transaction[]): MerchantChoice[] {
		const choicesByName = new Map<string, MerchantChoice & { count: number }>();
		for (const transaction of transactions) {
			if (!transaction.merchantName) continue;
			const choice = choicesByName.get(transaction.merchantName) ?? { id: transaction.merchantName, name: transaction.merchantName, logoUrl: transaction.logoUrl, count: 0 };
			choice.count += 1;
			choicesByName.set(transaction.merchantName, choice);
		}
		return [...choicesByName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map(({ id, name, logoUrl }) => ({ id, name, logoUrl }));
	}

	/** The merchant with the most transactions, or undefined when none has one. */
	public mostCommonMerchantName(transactions: Transaction[]): string | undefined {
		const transactionsByMerchant = Map.groupBy(
			transactions.filter(transaction => transaction.merchantName),
			transaction => transaction.merchantName as string
		);
		return [...transactionsByMerchant].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
	}

	private commonText(texts: string[]): string {
		const [firstText, ...otherTexts] = texts.map(text => text.trim());
		if (!firstText) return '';

		let longestShared = '';
		for (let startIndex = 0; startIndex < firstText.length; startIndex++) {
			for (let endIndex = firstText.length; endIndex > startIndex + longestShared.length; endIndex--) {
				const candidate = firstText.slice(startIndex, endIndex);
				if (otherTexts.every(text => text.toLowerCase().includes(candidate.toLowerCase()))) {
					longestShared = candidate;
					break;
				}
			}
		}

		return longestShared.trim().length >= MIN_COMMON_TEXT_LENGTH ? longestShared.trim() : '';
	}

	private inferFrom(pickedTransactions: Transaction[]): InferredDetails {
		if (!pickedTransactions.length) return {};

		const amounts = pickedTransactions.map(transaction => Math.abs(transaction.amount));
		const merchantNames = new Set(pickedTransactions.map(transaction => transaction.merchantName ?? ''));
		const merchantName = merchantNames.size === 1 ? [...merchantNames][0] : '';
		const accountIds = new Set(pickedTransactions.map(transaction => transaction.accountId));
		const logoUrls = new Set(pickedTransactions.map(transaction => transaction.logoUrl ?? ''));
		const logoUrl = logoUrls.size === 1 ? [...logoUrls][0] : '';
		const matchText = merchantName || this.commonText(pickedTransactions.map(transaction => transaction.description)) || pickedTransactions[0]?.description || '';

		return {
			name: merchantName || undefined,
			amount: roundToCents(median(amounts)),
			schedule: this.recurrence.infer(pickedTransactions.map(transaction => transaction.date)) ?? undefined,
			matchRule: {
				matchText,
				accountId: accountIds.size === 1 ? [...accountIds][0] : undefined,
				anyAmount: Math.max(...amounts) > Math.min(...amounts) * VARYING_AMOUNT_RATIO || undefined
			},
			icon: logoUrl ? { kind: 'logo', url: logoUrl } : undefined
		};
	}
}
