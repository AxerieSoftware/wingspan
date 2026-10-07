import type { Formatter } from '../formatter';
import { Tooltip } from './tooltip';

/** One due date in a sparkline: its amount if known, else whether it was paid. */
export interface SparkPoint {
	dueDate: string;
	paidDate: string | null;
	amount: number | null;
	paid: boolean;
	upcoming: boolean;
	empty?: boolean;
	/** Before Wingspan tracked it, with no payment found. */
	untracked?: boolean;
}

/** The due dates to draw, one bar each. */
export interface SparklineProps {
	points: SparkPoint[];
	formatter: Formatter;
}

/** What a bar's tooltip and the chart's accessible label say about one due date. */
export function describeSparkPoint(point: SparkPoint, formatter: Formatter): string {
	if (point.empty) return `${formatter.monthYear(point.dueDate)} · ${point.untracked ? 'not tracked yet' : 'nothing due'}`;

	const pointDate = formatter.longDate(point.paidDate ?? point.dueDate);
	if (point.upcoming) return `${pointDate} · upcoming`;
	if (point.amount !== null) return `${pointDate} · ${formatter.money(point.amount)}`;
	return point.paid ? `${pointDate} · paid` : `${pointDate} · not paid`;
}

/** A small bar chart of a recurring item's recent payments. A paid bar with no amount is full height. */
export function Sparkline({ points, formatter }: SparklineProps) {
	const tallestAmount = Math.max(1, ...points.map(point => point.amount ?? 0));
	const pointDescriptions = points.map(point => describeSparkPoint(point, formatter));

	return (
		<div className="justify-self-center">
			<div role="img" className="flex cursor-default items-stretch justify-end border-b border-chart-axis" style={{ width: 96, height: 24 }} aria-label={pointDescriptions.join('; ')}>
				{points.map((point, pointIndex) => {
					const barHeight = barHeightPercent(point, tallestAmount);

					return (
						<Tooltip key={point.dueDate} label={pointDescriptions[pointIndex] ?? ''} delay={0}>
							<div className="h-full min-w-0 shrink-0" style={{ width: 8 }}>
								<div className="group/sparkbar relative size-full cursor-default">
									{barHeight ? (
										<div
											className="absolute bottom-0 left-1/2 shrink-0 -translate-x-1/2 bg-chart-event-border-gray group-hover/sparkbar:bg-content-secondary"
											style={{ width: 5, height: `${barHeight}%` }}
										/>
									) : null}
								</div>
							</div>
						</Tooltip>
					);
				})}
			</div>
		</div>
	);
}

function barHeightPercent(point: SparkPoint, tallestAmount: number): number {
	if (point.amount !== null) return Math.max(8, (point.amount / tallestAmount) * 100);
	return point.paid ? 100 : 0;
}
