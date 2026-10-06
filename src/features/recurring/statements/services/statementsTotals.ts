import { type ReadonlySignal, signal } from '@preact/signals-core';
import { isSameValue } from '../../../../common/sameValue';

/** This month's card statements: paid so far, and left to pay. */
export interface StatementsMonthTotals {
	paid: number;
	left: number;
	/** Unpaid statements with an unknown amount, e.g. a card with no balance from Monarch. */
	unknownCount: number;
}

/** This month's card statement totals from the Statements table, used by the month summary next to it. */
export class StatementsTotals {
	private readonly current = signal<StatementsMonthTotals | null>(null);

	/** Null while this month isn't shown, or its payments can't be checked yet. */
	public get totals(): ReadonlySignal<StatementsMonthTotals | null> {
		return this.current;
	}

	/** Null hides the summary line. Equal totals don't notify. */
	public publish(totals: StatementsMonthTotals | null): void {
		if (!isSameValue(totals, this.current.peek())) this.current.value = totals;
	}
}
