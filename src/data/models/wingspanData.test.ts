import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { RecurringItem } from '../../features/recurring/recurringItems/models/recurringItem';
import { emptyWingspanData, hasWingspanData, mergeWingspanData, type WingspanData, WingspanDataSchema } from './wingspanData';

const recurring = { trackingSince: '2026-01', recurringItems: [] };
const recurringDueDates = { dueDatesByRecurrenceId: { rent: 1 } };

describe('saved data', () => {
	it('loads defaults when cash and card settings were never saved', () => {
		const result = v.safeParse(WingspanDataSchema, { recurring, recurringDueDates });

		expect(result.success).toBe(true);
		expect(result.output).toMatchObject({ recurringDueDates, cashSettings: { cushion: 0 }, businessCashSettings: {} });
	});

	it('keeps saved cash and card settings', () => {
		const cashSettings = { cushion: 1000, reserveAccountIds: ['savings'] };

		expect(v.parse(WingspanDataSchema, { recurring, recurringDueDates, cashSettings }).cashSettings).toEqual(cashSettings);
	});
});

describe('merging two copies', () => {
	const item = (id: string, name: string): RecurringItem => ({
		id,
		kind: 'bill',
		name,
		recurrence: 'DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1',
		amount: 10,
		active: true,
		since: '2026-01'
	});
	const dataOf = (items: RecurringItem[], dueDays: Record<string, number> = {}, cushion = 0): WingspanData => ({
		recurring: { trackingSince: '2026-01', recurringItems: items },
		recurringDueDates: { dueDatesByRecurrenceId: dueDays },
		cashSettings: { cushion },
		businessCashSettings: {},
		hsaReimbursementTags: { toReimburseTagId: '', reimbursedTagId: '' }
	});
	const names = (data: WingspanData) => data.recurring.recurringItems.map(each => each.name);

	it('takes from each side only what changed there since the base', () => {
		const base = dataOf([item('1', 'Rent'), item('2', 'Phone')], { rent: 1 }, 100);
		const theirs = dataOf([item('1', 'Rent!'), item('2', 'Phone')], { rent: 1 }, 500);
		const ours = dataOf([item('1', 'Rent'), item('2', 'Phone 2')], { rent: 3 }, 100);

		const merged = mergeWingspanData(theirs, ours, base);

		expect(names(merged)).toEqual(['Rent!', 'Phone 2']);
		expect(merged.recurringDueDates.dueDatesByRecurrenceId).toEqual({ rent: 3 });
		expect(merged.cashSettings.cushion).toBe(500);
	});

	it('keeps a removal from either side, unless the other side edited the item since', () => {
		const base = dataOf([item('1', 'Rent'), item('2', 'Phone'), item('3', 'Gym')]);
		const theirs = dataOf([item('2', 'Phone'), item('3', 'Gym')]);
		const ours = dataOf([item('1', 'Rent'), item('3', 'Gym+')]);

		expect(names(mergeWingspanData(theirs, ours, base))).toEqual(['Gym+']);
		expect(names(mergeWingspanData(dataOf([item('2', 'Phone!')]), dataOf([]), dataOf([item('2', 'Phone')])))).toEqual(['Phone!']);
	});

	it('without a base, keeps everything from both, ours winning', () => {
		const merged = mergeWingspanData(dataOf([item('1', 'Rent'), item('2', 'Phone')]), dataOf([item('1', 'Rent 2'), item('3', 'Gym')]));

		expect(names(merged)).toEqual(['Rent 2', 'Phone', 'Gym']);
	});

	it('keeps fields saved by a newer version of Wingspan', () => {
		const theirs = { ...dataOf([]), futureFeature: true } as WingspanData;

		expect(mergeWingspanData(theirs, dataOf([]), dataOf([]))).toMatchObject({ futureFeature: true });
	});
});

describe("merging each business's cash and card settings", () => {
	const data = (businessCashSettings: WingspanData['businessCashSettings']) =>
		({ recurring, recurringDueDates, cashSettings: { cushion: 0 }, businessCashSettings, hsaReimbursementTags: { toReimburseTagId: '', reimbursedTagId: '' } }) as WingspanData;

	it("takes each business's from whichever side changed it", () => {
		const base = data({ studio: { cushion: 100 }, shop: { cushion: 200 } });
		const merged = mergeWingspanData(data({ studio: { cushion: 150 }, shop: { cushion: 200 } }), data({ studio: { cushion: 100 }, shop: { cushion: 250 } }), base);

		expect(merged.businessCashSettings).toEqual({ studio: { cushion: 150 }, shop: { cushion: 250 } });
	});

	it("keeps a business's settings set on only one side, and leaves out ones never set", () => {
		const merged = mergeWingspanData(data({ studio: { cushion: 0 } }), data({ shop: { cushion: 300 } }));

		expect(merged.businessCashSettings).toEqual({ shop: { cushion: 300 } });
	});

	it('counts as saved data', () => {
		expect(hasWingspanData({ ...emptyWingspanData(), businessCashSettings: { studio: { cushion: 300 } } })).toBe(true);
		expect(hasWingspanData({ ...emptyWingspanData(), businessCashSettings: { studio: { cushion: 0 } } })).toBe(false);
	});
});

describe('merging the chosen HSA tags', () => {
	const withTags = (toReimburseTagId: string): WingspanData => ({ ...emptyWingspanData(), hsaReimbursementTags: { toReimburseTagId, reimbursedTagId: '' } });

	it("keeps another browser's choice when this browser never chose", () => {
		expect(mergeWingspanData(withTags('hsa'), emptyWingspanData()).hsaReimbursementTags.toReimburseTagId).toBe('hsa');
		expect(mergeWingspanData(withTags('hsa'), emptyWingspanData(), emptyWingspanData()).hsaReimbursementTags.toReimburseTagId).toBe('hsa');
	});

	it('takes the choice from whichever side changed it', () => {
		expect(mergeWingspanData(withTags('hsa'), withTags('medical'), withTags('hsa')).hsaReimbursementTags.toReimburseTagId).toBe('medical');
	});
});

describe('merging fields added by a newer version of Wingspan', () => {
	it('takes each from whichever side changed it', () => {
		const data = (futureFeature: number) => ({ ...emptyWingspanData(), recurring, recurringDueDates, futureFeature }) as unknown as WingspanData;

		expect(mergeWingspanData(data(2), data(1), data(1))).toMatchObject({ futureFeature: 2 });
		expect(mergeWingspanData(data(1), data(3), data(1))).toMatchObject({ futureFeature: 3 });
	});
});

describe('merging which Walmart orders were sent to Monarch', () => {
	const withSent = (orderIds: string[], lastSyncedOn = '') => ({ ...emptyWingspanData(), walmartSync: { uploadedOrderIds: orderIds, lastSyncedOn } });

	it('keeps every order either browser sent, regardless of the base, and the later sync date', () => {
		const merged = mergeWingspanData(withSent(['a', 'b'], '2026-10-01'), withSent(['b', 'c'], '2026-10-03'), withSent(['a', 'b', 'z'], '2026-09-01'));

		expect(merged.walmartSync).toEqual({ uploadedOrderIds: ['a', 'b', 'c'], lastSyncedOn: '2026-10-03' });
	});
});
