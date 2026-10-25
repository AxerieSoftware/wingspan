import * as v from 'valibot';
import type { TransactionTag } from '../../../../monarch/api/models/taggedTransaction';

/** The query key for the household's Monarch tags, shared so a refresh on the HSA's page reaches Budget's notes too. */
export const TRANSACTION_TAGS_QUERY = 'monarchTransactionTags';

/** The Monarch tags that mark HSA expenses: one still to reimburse and one already reimbursed. Empty until chosen. */
export interface HsaReimbursementTags {
	toReimburseTagId: string;
	reimbursedTagId: string;
}

export const HsaReimbursementTagsSchema: v.GenericSchema<Partial<HsaReimbursementTags>, HsaReimbursementTags> = v.looseObject({
	toReimburseTagId: v.optional(v.string(), ''),
	reimbursedTagId: v.optional(v.string(), '')
});

export const emptyHsaReimbursementTags = (): HsaReimbursementTags => ({ toReimburseTagId: '', reimbursedTagId: '' });

export const hasChosenHsaReimbursementTags = (tags: HsaReimbursementTags): boolean => tags.toReimburseTagId !== '' || tags.reimbursedTagId !== '';

/** Tags named for it, like "HSA – Reimburse" and "HSA – Reimbursed", until the household chooses. Then each chosen tag that still exists, so None sticks. */
export function resolveHsaReimbursementTags(saved: HsaReimbursementTags, tags: TransactionTag[]): HsaReimbursementTags {
	const existingOrNone = (tagId: string) => (tags.some(tag => tag.id === tagId) ? tagId : '');
	if (hasChosenHsaReimbursementTags(saved)) return { toReimburseTagId: existingOrNone(saved.toReimburseTagId), reimbursedTagId: existingOrNone(saved.reimbursedTagId) };

	const hsaTags = tags.filter(tag => /\bhsa\b/i.test(tag.name));
	return {
		toReimburseTagId: hsaTags.find(tag => /reimburse(?!d)/i.test(tag.name))?.id ?? '',
		reimbursedTagId: hsaTags.find(tag => /reimbursed/i.test(tag.name))?.id ?? ''
	};
}
