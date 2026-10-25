import type { TooltipRowLook } from '../../../../monarch/pages/cashFlow/cashFlowChart';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { PROJECTED_DASH } from './monthEndBars';

export interface MonthEndTooltipRowsProps {
	look: TooltipRowLook;
	/** This month's projected totals: what Monarch has so far plus what's still expected. */
	income: number;
	expenses: number;
	incomeColor: string;
	expensesColor: string;
	formatter: Formatter;
}

/** Projected month-end totals under the rows of Monarch's tooltip for this month, with dashed markers like the bars' extensions. */
export function MonthEndTooltipRows({ look, income, expenses, incomeColor, expensesColor, formatter }: MonthEndTooltipRowsProps) {
	const rows = [
		{ label: 'Projected income:', amount: income, color: incomeColor },
		{ label: 'Projected expenses:', amount: expenses, color: expensesColor }
	];
	return rows.map(({ label, amount, color }) => (
		<div key={label} className={look.rowClassName}>
			<span className={look.iconClassName}>
				<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke={color} strokeWidth={2} strokeDasharray={PROJECTED_DASH} aria-hidden="true">
					<circle cx={12} cy={12} r={10} />
				</svg>
			</span>
			<span className={look.labelClassName}>{label}</span>
			<span className="fs-mask">{formatter.wholeMoney(amount)}</span>
		</div>
	));
}
