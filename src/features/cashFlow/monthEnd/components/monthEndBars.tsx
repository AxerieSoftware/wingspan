import type { ChartColumn } from '../../../../monarch/pages/cashFlow/cashFlowChart';
import type { Formatter } from '../../../../monarch/ui/formatter';
import type { MonthEndExpectation } from '../models/monthEndExpectation';

/** The dash of anything projected: these bars' extensions and the markers of their tooltip rows. */
export const PROJECTED_DASH = '4 3';
const GHOST_OPACITY = 0.2;

export interface MonthEndBarsProps {
	column: ChartColumn;
	expected: MonthEndExpectation;
	formatter: Formatter;
}

/** Dashed extensions of this month's income and expenses bars, out to where they're projected to end the month. Kept inside the plot. */
export function MonthEndBars({ column, expected, formatter }: MonthEndBarsProps) {
	const { chartWidth, chartHeight, left, barWidth, pixelsPerDollar, plotTop, plotBottom, incomeTop, expensesBottom } = column;
	const incomeHeight = Math.min(expected.income * pixelsPerDollar, Math.max(0, incomeTop - plotTop));
	const expensesHeight = Math.min(expected.expenses * pixelsPerDollar, Math.max(0, plotBottom - expensesBottom));
	const label = `Projected by ${formatter.shortDate(expected.monthEnd)}: ${formatter.wholeMoney(expected.income)} more income and ${formatter.wholeMoney(expected.expenses)} more expenses`;

	return (
		<svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }}>
			{incomeHeight > 0 && (
				<rect
					x={left}
					y={incomeTop - incomeHeight}
					width={barWidth}
					height={incomeHeight}
					fill={column.incomeColor}
					fillOpacity={GHOST_OPACITY}
					stroke={column.incomeColor}
					strokeDasharray={PROJECTED_DASH}
				/>
			)}
			{expensesHeight > 0 && (
				<rect
					x={left}
					y={expensesBottom}
					width={barWidth}
					height={expensesHeight}
					fill={column.expensesColor}
					fillOpacity={GHOST_OPACITY}
					stroke={column.expensesColor}
					strokeDasharray={PROJECTED_DASH}
				/>
			)}
		</svg>
	);
}
