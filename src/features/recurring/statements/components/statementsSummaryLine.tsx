import type { CSSProperties } from 'react';
import type { Formatter } from '../../../../monarch/ui/formatter';
import type { StatementsMonthTotals } from '../services/statementsTotals';

/** `totals` are this month's, as last calculated by the Statements table. */
export interface StatementsSummaryLineProps {
	totals: StatementsMonthTotals;
	formatter: Formatter;
}

const TRACK_STYLE = { '--mds-track-bg-color': 'var(--progress-background)' } as CSSProperties;

/** The Statements line in the month summary, styled like Monarch's Expenses line: how much of this month's statements is paid, and how much is left. */
export function StatementsSummaryLine({ totals, formatter }: StatementsSummaryLineProps) {
	const { paid, left, unknownCount } = totals;
	const due = paid + left;
	if (due === 0 && unknownCount === 0) return <span className="text-sm font-book text-content-secondary">No card payments due this month</span>;

	const share = due > 0 ? Math.min(1, paid / due) : 0;
	const unknownText = unknownCount ? ` + ${unknownCount} unknown` : '';
	return (
		<div className="flex w-full flex-col gap-2xs">
			<div
				role="meter"
				aria-label="Statements paid"
				aria-valuemin={0}
				aria-valuemax={due}
				aria-valuenow={paid}
				aria-valuetext={formatter.percent(share)}
				data-mds="meter"
				className="relative flex h-1.5 w-full rounded-sm"
			>
				<div data-mds="meter-track" className="relative flex size-full overflow-hidden rounded-sm bg-(--mds-track-bg-color)" style={TRACK_STYLE}>
					<div className="h-full shrink-0 bg-progress-danger" style={{ width: `${share * 100}%` }} />
				</div>
			</div>
			<div className="flex w-full items-center justify-between gap-xs text-sm font-medium">
				<span className="text-content-primary">{`${formatter.wholeMoney(paid)} paid`}</span>
				<span className="text-content-secondary">{`${formatter.wholeMoney(left)} left${unknownText}`}</span>
			</div>
		</div>
	);
}
