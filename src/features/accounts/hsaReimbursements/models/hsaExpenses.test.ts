import { describe, expect, it } from 'vitest';
import type { TaggedTransaction } from '../../../../monarch/api/models/taggedTransaction';
import { toHsaExpenses } from './hsaExpenses';
import { resolveHsaReimbursementTags } from './hsaReimbursementTags';

const TAGS = { toReimburseTagId: 'to-reimburse', reimbursedTagId: 'reimbursed' };

const expense = (id: string, date: string, amount: number, tagIds: string[]): TaggedTransaction => ({ id, date, amount, merchantName: 'Contoso Clinic', notes: '', hasAttachments: false, tagIds });

describe('splitting tagged HSA expenses', () => {
	it('counts every tagged expense in exactly one list, so the totals add up to everything tagged', () => {
		const transactions = [
			expense('a', '2026-03-18', -939.4, ['to-reimburse']),
			expense('b', '2026-01-02', -0.1, ['to-reimburse']),
			expense('c', '2026-05-26', -603.84, ['to-reimburse', 'reimbursed']),
			expense('d', '2025-11-30', -0.2, ['reimbursed']),
			expense('a', '2026-03-18', -939.4, ['to-reimburse'])
		];

		const expenses = toHsaExpenses(transactions, TAGS);

		expect(expenses.toReimburse.map(transaction => transaction.id)).toEqual(['b', 'a']);
		expect(expenses.reimbursed.map(transaction => transaction.id)).toEqual(['c', 'd']);
		expect(expenses.toReimburseTotal).toBe(939.5);
		expect(expenses.reimbursedTotal).toBe(604.04);
		expect(expenses.toReimburseTotal + expenses.reimbursedTotal).toBeCloseTo(939.4 + 0.1 + 603.84 + 0.2, 10);
	});

	it('lowers the total by a tagged refund', () => {
		const expenses = toHsaExpenses([expense('bill', '2026-02-01', -250, ['to-reimburse']), expense('refund', '2026-02-10', 40.25, ['to-reimburse'])], TAGS);

		expect(expenses.toReimburseTotal).toBe(209.75);
	});
});

describe('choosing the HSA tags', () => {
	const tags = [
		{ id: 'sync', name: 'Retail Sync', color: '#f86713' },
		{ id: 'to', name: 'HSA – Reimburse', color: '#1baf7a' },
		{ id: 'done', name: 'HSA – Reimbursed', color: '#1baf7a' }
	];

	it('uses tags named for it until others are chosen', () => {
		expect(resolveHsaReimbursementTags({ toReimburseTagId: '', reimbursedTagId: '' }, tags)).toEqual({ toReimburseTagId: 'to', reimbursedTagId: 'done' });
		expect(resolveHsaReimbursementTags({ toReimburseTagId: 'sync', reimbursedTagId: '' }, tags)).toEqual({ toReimburseTagId: 'sync', reimbursedTagId: 'done' });
	});

	it('falls back to the named tag when the chosen one was deleted in Monarch', () => {
		expect(resolveHsaReimbursementTags({ toReimburseTagId: 'deleted', reimbursedTagId: 'deleted' }, tags)).toEqual({ toReimburseTagId: 'to', reimbursedTagId: 'done' });
	});
});
