import * as v from 'valibot';
import type { TransactionTag } from '../../../../monarch/api/models/taggedTransaction';

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

/** The chosen tags that still exist, else tags named for it, like "HSA – Reimburse" and "HSA – Reimbursed". */
export function resolveHsaReimbursementTags(saved: HsaReimbursementTags, tags: TransactionTag[]): HsaReimbursementTags {
	const exists = (tagId: string) => tags.some(tag => tag.id === tagId);
	const hsaTags = tags.filter(tag => /\bhsa\b/i.test(tag.name));
	const namedReimbursed = hsaTags.find(tag => /reimbursed/i.test(tag.name));
	const namedToReimburse = hsaTags.find(tag => /reimburse(?!d)/i.test(tag.name));
	return {
		toReimburseTagId: exists(saved.toReimburseTagId) ? saved.toReimburseTagId : (namedToReimburse?.id ?? ''),
		reimbursedTagId: exists(saved.reimbursedTagId) ? saved.reimbursedTagId : (namedReimbursed?.id ?? '')
	};
}
