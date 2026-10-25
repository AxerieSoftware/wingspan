import type { Formatter } from '../../../../monarch/ui/formatter';
import { WingspanMark } from '../../../wingspanMark';

export interface HsaSpendingNoteProps {
	amount: number;
	formatter: Formatter;
}

/** A line under a Budget row's name: how much of its spending this month came from the HSA. */
export function HsaSpendingNote({ amount, formatter }: HsaSpendingNoteProps) {
	return (
		<span className="inline-flex items-center gap-2xs text-xs font-book text-content-secondary">
			{formatter.wholeMoney(amount)} paid from HSA
			<WingspanMark label="Spending on your HSA, plus expenses tagged to reimburse from it or already reimbursed. Monarch's budget still counts it." />
		</span>
	);
}
