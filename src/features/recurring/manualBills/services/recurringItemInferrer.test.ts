import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import type { EditedField, RecurringItemDraft } from '../../recurringItems/models/recurringItemDraft';
import { RecurrenceCalculator } from '../../recurringItems/services/recurrenceCalculator';
import { RecurringItemInferrer } from './recurringItemInferrer';

const CHECKING = 'checking';
const SAVINGS = 'savings';
const IS_NEW = true;

const inferrer = new RecurringItemInferrer(new RecurrenceCalculator(new Calendar(() => Temporal.PlainDate.from('2026-10-15'))));
const payment = (date: string, amount: number): Transaction => ({ id: date, date, amount: -amount, description: 'FABRIKAM WATER 0042', merchantName: 'Fabrikam Water', accountId: CHECKING });
const varyingPayments = [payment('2026-07-03', 40), payment('2026-08-03', 65), payment('2026-09-03', 52)];
const draftWith = (matchRule: RecurringItemDraft['item']['matchRule']): RecurringItemDraft => ({
	item: { id: 'water', kind: 'bill', name: '', recurrence: '', amount: 0, active: true, since: '2026-10', matchRule },
	schedule: { every: 1, unit: 'month', start: '2026-10-03', monthDay: 3 }
});
const inferredRule = (draft: RecurringItemDraft, editedFields: EditedField[]) => inferrer.applyTo(draft, varyingPayments, new Set(editedFields), IS_NEW).item.matchRule;

describe('RecurringItemInferrer', () => {
	it('infers the match rule from picked payments when nothing was edited', () => {
		expect(inferredRule(draftWith(undefined), [])).toEqual({ matchText: 'Fabrikam Water', accountId: CHECKING, anyAmount: true });
	});

	it('keeps typed match text but still infers Any amount and Paid from', () => {
		expect(inferredRule(draftWith({ matchText: 'fabrikam' }), ['matchText'])).toEqual({ matchText: 'fabrikam', accountId: CHECKING, anyAmount: true });
	});

	it('keeps a chosen Paid from and Any amount over the inferred ones', () => {
		const draft = draftWith({ matchText: 'Water', accountId: SAVINGS, anyAmount: undefined });

		expect(inferredRule(draft, ['payerAccount', 'anyAmount'])).toEqual({ matchText: 'Fabrikam Water', accountId: SAVINGS, anyAmount: undefined });
	});
});
