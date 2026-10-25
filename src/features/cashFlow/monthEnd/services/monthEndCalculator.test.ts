import { describe, expect, it } from 'vitest';
import { Calendar } from '../../../../common/calendar';
import type { FlowKind, ProjectedDay, Projection } from '../../projectedBalances/models/projection';
import { MonthEndCalculator } from './monthEndCalculator';

const calculator = new MonthEndCalculator(new Calendar(() => Temporal.PlainDate.from('2026-10-24')));
const flow = (amount: number, kind: FlowKind, accountId?: string) => ({ date: '', amount, label: kind, kind, accountId });
const day = (date: string, ...flows: ReturnType<typeof flow>[]) => ({ date, flows }) as unknown as ProjectedDay;
const projectionOf = (days: ProjectedDay[], monthlyByAccountId: [string, number][] = []) => ({ days, pace: { monthlyByAccountId: new Map(monthlyByAccountId) } }) as unknown as Projection;

describe('what the rest of the month still holds', () => {
	it("counts income and bills through the month's last day, on any account, and nothing after", () => {
		const projection = projectionOf([
			day('2026-10-24', flow(1600.1, 'income'), flow(-45.5, 'bill')),
			day('2026-10-31', flow(-120.25, 'bill', 'card-1'), flow(900, 'income')),
			day('2026-11-01', flow(3200, 'income'), flow(-1500, 'bill'))
		]);

		expect(calculator.expected(projection)).toEqual({ monthEnd: '2026-10-31', income: 2500.1, expenses: 165.75 });
	});

	it('leaves out card payments and draws, which only move money between accounts', () => {
		const projection = projectionOf([day('2026-10-25', flow(-400, 'cardPayment'), flow(250, 'draw', 'card-1'))]);

		expect(calculator.expected(projection)).toEqual({ monthEnd: '2026-10-31', income: 0, expenses: 0 });
	});

	// Invariant: spending is the pace across every account for each day after today, counted once even though checking's share also shows as flows.
	it("adds everyday spending at the pace of every account for each day after today, without counting checking's spending flows again", () => {
		const projection = projectionOf(
			[day('2026-10-25', flow(-10, 'spending'))],
			[
				['checking', 365],
				['card-1', 730]
			]
		);

		// $1,095 a month is $36 a day over an average month; 7 days remain after the 24th.
		expect(calculator.expected(projection).expenses).toBe(252);
	});
});
