import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../common/calendar';
import { CashFlowPeriod } from './cashFlowPeriod';

const calendar = new Calendar(() => Temporal.PlainDate.from('2026-10-11'));

describe('Cash Flow period', () => {
	it('is the month, quarter or year holding today when the page shows the current one', () => {
		expect(CashFlowPeriod.of('month', null, calendar)).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31' });
		expect(CashFlowPeriod.of('quarter', null, calendar)).toMatchObject({ startDate: '2026-10-01', endDate: '2026-12-31' });
		expect(CashFlowPeriod.of('year', null, calendar)).toMatchObject({ startDate: '2026-01-01', endDate: '2026-12-31' });
	});

	it("starts on the page's date", () => {
		expect(CashFlowPeriod.of('month', '2026-02-01', calendar)).toMatchObject({ startDate: '2026-02-01', endDate: '2026-02-28' });
		expect(CashFlowPeriod.of('quarter', '2026-04-01', calendar)).toMatchObject({ startDate: '2026-04-01', endDate: '2026-06-30' });
		expect(CashFlowPeriod.of('year', '2025-01-01', calendar)).toMatchObject({ startDate: '2025-01-01', endDate: '2025-12-31' });
	});
});
