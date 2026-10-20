import { describe, expect, it } from 'vitest';
import { resolveHsaReimbursementTags } from './hsaReimbursementTags';

const TAGS = [
	{ id: 'sync', name: 'Retail Sync', color: '#f86713' },
	{ id: 'to', name: 'HSA – Reimburse', color: '#1baf7a' },
	{ id: 'done', name: 'HSA – Reimbursed', color: '#1baf7a' }
];

describe('resolveHsaReimbursementTags', () => {
	it('uses tags named for it until the household chooses', () => {
		expect(resolveHsaReimbursementTags({ toReimburseTagId: '', reimbursedTagId: '' }, TAGS)).toEqual({ toReimburseTagId: 'to', reimbursedTagId: 'done' });
	});

	it('keeps None for the reimbursed tag once tags are chosen, even when a named tag exists', () => {
		expect(resolveHsaReimbursementTags({ toReimburseTagId: 'sync', reimbursedTagId: '' }, TAGS)).toEqual({ toReimburseTagId: 'sync', reimbursedTagId: '' });
	});

	it('drops a chosen tag that was deleted in Monarch instead of switching to a named one', () => {
		expect(resolveHsaReimbursementTags({ toReimburseTagId: 'deleted', reimbursedTagId: 'done' }, TAGS)).toEqual({ toReimburseTagId: '', reimbursedTagId: 'done' });
	});
});
