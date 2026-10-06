import { type MouseEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { afterCardsOf, type ProjectedDay, type ProjectionEvent, type ProjectionEventKind, type ScheduledFlow } from '../models/projection';

const HEIGHT = 320;
const PLOT_LEFT = 63;
const PLOT_RIGHT_GAP = 16;
const PLOT_TOP = 44;
const PLOT_BOTTOM_GAP = 30;
const Y_LABEL_X = 43;
const TARGET_Y_TICKS = 6;
const TARGET_X_TICKS = 8;
const MARKER_SIZE = 20;
const MAX_TOOLTIP_FLOWS = 5;
const TOOLTIP_WIDTH = 240;
const TOOLTIP_GAP = 16;
const TOOLTIP_TALLEST = 200;
/** Beyond about two months there are too many paydays and card payments to mark. */
const MAX_MARKED_DAYS = 62;

/** cushion is the amount kept in checking; freeCash is drawn as a band above it. */
export interface BalanceChartProps {
	days: ProjectedDay[];
	events: ProjectionEvent[];
	cushion: number;
	freeCash: number;
	formatter: Formatter;
}

interface Marker {
	kind: 'income' | 'cardPayment' | ProjectionEventKind;
	index: number;
}

const ALERT = { background: 'var(--chart-event-background-red)', foreground: 'var(--chart-event-foreground-red)' };
const MARKER_COLORS: Record<Marker['kind'], { background: string; foreground: string }> = {
	income: { background: 'var(--chart-event-background-green)', foreground: 'var(--chart-event-foreground-green)' },
	cardPayment: { background: 'var(--chart-event-background-orange)', foreground: 'var(--chart-event-foreground-orange)' },
	cushionUsed: { background: 'var(--chart-event-background-yellow)', foreground: 'var(--chart-event-foreground-yellow)' },
	cardMaxedOut: ALERT,
	outOfCash: ALERT
};
const COMPACT_FROM = 1000;
const AFTER_CARDS_COLOR = 'var(--content-purple)';

/** Styled like Monarch's forecast chart. The green band is free cash above the cushion; the dashed line is checking minus what the cards owe. */
export function BalanceChart({ days, events, cushion, freeCash, formatter }: BalanceChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(containerRef);
	const [hover, setHover] = useState<{ index: number; y: number } | null>(null);
	const hoverIndex = hover?.index ?? null;
	const ids = useId().replaceAll(':', '');

	// Compact format rounds amounts under $1,000 to a dime, which wouldn't match the stats, so those use the full format.
	const lineLabelMoney = (amount: number) => (Math.abs(amount) < COMPACT_FROM ? formatter.money(amount) : formatter.compactMoney(amount));
	const plotRight = Math.max(PLOT_LEFT + 1, width - PLOT_RIGHT_GAP);
	const plotBottom = HEIGHT - PLOT_BOTTOM_GAP;
	const values = [0, cushion, ...days.flatMap(day => [day.lowestChecking, day.checking, day.lowestAfterCards])];
	const ticks = niceTicks(Math.min(...values), Math.max(...values));
	const [domainLow, domainHigh] = [ticks[0] as number, ticks.at(-1) as number];
	const step = days.length > 1 ? (plotRight - PLOT_LEFT) / (days.length - 1) : 0;
	const xOf = (index: number) => PLOT_LEFT + index * step;
	const yOf = (balance: number) => plotBottom - ((balance - domainLow) / (domainHigh - domainLow || 1)) * (plotBottom - PLOT_TOP);
	const offsetOf = (balance: number) => Math.min(1, Math.max(0, (yOf(balance) - PLOT_TOP) / (plotBottom - PLOT_TOP)));

	// A day's closing balance is plotted at its x; its low (after outflows, before inflows) is plotted half a day earlier.
	const lowXOf = (index: number) => (index === 0 ? xOf(0) : xOf(index) - step / 2);
	const pathOf = (lowOf: (day: ProjectedDay) => number, closeOf: (day: ProjectedDay) => number) =>
		days
			.flatMap((day, index) =>
				index === 0
					? [[xOf(index), yOf(lowOf(day))]]
					: [
							[lowXOf(index), yOf(lowOf(day))],
							[xOf(index), yOf(closeOf(day))]
						]
			)
			.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`)
			.join('');
	const path = pathOf(
		day => day.lowestChecking,
		day => day.checking
	);
	const afterCardsPath = days.some(day => day.cardsOwed > 0)
		? pathOf(
				day => day.lowestAfterCards,
				day => afterCardsOf(day)
			)
		: null;
	const lowestIndex = days.reduce((lowestSoFar, day, index) => (day.lowestChecking < (days[lowestSoFar]?.lowestChecking ?? Number.POSITIVE_INFINITY) ? index : lowestSoFar), 0);
	const lowest = days[lowestIndex];
	const lowestDate = lowest?.date ?? '';
	const markers = markersOf(days, events);
	const xTickEvery = Math.max(1, Math.ceil(days.length / TARGET_X_TICKS));
	const hoverDay = hoverIndex !== null ? days[hoverIndex] : undefined;

	const trackHover = (event: MouseEvent<SVGRectElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const index = Math.round((event.clientX - bounds.left) / (step || 1));
		setHover({ index: Math.min(days.length - 1, Math.max(0, index)), y: event.clientY - bounds.top });
	};

	return (
		<div className="flex flex-col gap-xs">
			<div ref={containerRef} className="relative w-full min-w-0" style={{ height: HEIGHT }}>
				{width > 0 && days.length > 1 ? (
					<svg
						width={width}
						height={HEIGHT}
						role="img"
						aria-label={`Checking from ${formatter.shortDate(days[0]?.date ?? lowestDate)} to ${formatter.shortDate(days.at(-1)?.date ?? lowestDate)}, lowest ${formatter.money(lowest?.lowestChecking ?? 0)} on ${formatter.shortDate(lowestDate)}`}
						className="block"
					>
						<defs>
							<linearGradient id={`${ids}-line`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_TOP} x2="0" y2={plotBottom}>
								<stop offset={0} stopColor="var(--content-primary)" />
								<stop offset={offsetOf(cushion)} stopColor="var(--content-primary)" />
								<stop offset={offsetOf(cushion)} stopColor="var(--content-danger)" />
								<stop offset={1} stopColor="var(--content-danger)" />
							</linearGradient>
							<pattern id={`${ids}-negative`} patternUnits="userSpaceOnUse" width="9" height="13" patternTransform="rotate(0)">
								<path d="M10.6 -0.75L-1 16.1" stroke="var(--chart-negative-area)" strokeWidth="1.5" />
							</pattern>
						</defs>

						{ticks.map(tick => (
							<g key={tick}>
								<line x1={PLOT_LEFT} x2={plotRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--chart-axis)" />
								<text x={Y_LABEL_X} y={yOf(tick)} dy="0.355em" textAnchor="end" fontSize={12} fontWeight={500} fill="var(--chart-label)">
									{formatter.compactMoney(tick)}
								</text>
							</g>
						))}

						{domainLow < 0 ? <rect x={PLOT_LEFT} y={yOf(0)} width={plotRight - PLOT_LEFT} height={plotBottom - yOf(0)} fill={`url(#${ids}-negative)`} fillOpacity={0.5} /> : null}
						{freeCash > 0 ? (
							<>
								<rect x={PLOT_LEFT} y={yOf(cushion + freeCash)} width={plotRight - PLOT_LEFT} height={yOf(cushion) - yOf(cushion + freeCash)} fill="var(--chart-fill-green)" fillOpacity={0.14} />
								<line x1={PLOT_LEFT} x2={plotRight} y1={yOf(cushion + freeCash)} y2={yOf(cushion + freeCash)} stroke="var(--content-success)" strokeOpacity={0.5} />
								<LineLabel x={plotRight} y={yOf(cushion + freeCash)} fill="var(--content-success)">{`Free cash ${lineLabelMoney(freeCash)}`}</LineLabel>
							</>
						) : null}
						<line x1={PLOT_LEFT} x2={plotRight} y1={yOf(0)} y2={yOf(0)} stroke="var(--chart-label)" />
						{cushion > 0 ? (
							<>
								<line x1={PLOT_LEFT} x2={plotRight} y1={yOf(cushion)} y2={yOf(cushion)} stroke="var(--chart-label)" strokeDasharray="4 4" />
								<LineLabel x={plotRight} y={yOf(cushion)} fill="var(--chart-label)">{`Kept ${lineLabelMoney(cushion)}`}</LineLabel>
							</>
						) : null}

						{markers.map((marker, order) => {
							const stackedAbove = markers.slice(0, order).filter(other => other.index === marker.index).length;
							return <EventMarker key={`${marker.kind}-${marker.index}`} marker={marker} x={xOf(marker.index)} y={8 + stackedAbove * (MARKER_SIZE + 4)} plotBottom={plotBottom} />;
						})}

						{afterCardsPath ? <path d={afterCardsPath} fill="none" stroke={AFTER_CARDS_COLOR} strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" /> : null}
						<path d={path} fill="none" stroke={`url(#${ids}-line)`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

						{days.map((day, index) =>
							index % xTickEvery === 0 ? (
								<text key={day.date} x={xOf(index)} y={plotBottom + 12} dy="0.71em" textAnchor="middle" fontSize={12} fontWeight={500} fill="var(--chart-label)">
									{index === 0 ? 'Today' : formatter.shortDate(day.date)}
								</text>
							) : null
						)}

						<Dot x={xOf(0)} y={yOf(days[0]?.lowestChecking ?? 0)} fill="var(--content-brand)" />
						{lowest && lowestIndex > 0 ? (
							<Dot x={lowXOf(lowestIndex)} y={yOf(lowest.lowestChecking)} fill={lowest.lowestChecking < cushion ? 'var(--content-danger)' : 'var(--content-primary)'} />
						) : null}

						{hoverDay && hoverIndex !== null ? (
							<>
								<line x1={xOf(hoverIndex)} x2={xOf(hoverIndex)} y1={PLOT_TOP} y2={plotBottom} stroke="var(--divider-secondary)" />
								<Dot x={xOf(hoverIndex)} y={yOf(hoverDay.checking)} fill="var(--content-primary)" />
							</>
						) : null}

						<rect x={PLOT_LEFT} y={0} width={plotRight - PLOT_LEFT} height={plotBottom} fill="transparent" onMouseMove={trackHover} onMouseLeave={() => setHover(null)} />
					</svg>
				) : null}
				{hoverDay && hover ? (
					<DayTooltip
						day={hoverDay}
						events={events.filter(event => event.date === hoverDay.date)}
						{...tooltipPosition(xOf(hover.index), hover.y, width)}
						width={Math.min(TOOLTIP_WIDTH, width)}
						formatter={formatter}
					/>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-lg pl-2xl text-xs font-medium text-content-secondary">
				<LegendItem color="var(--content-primary)" label="Checking" />
				{afterCardsPath ? <LegendItem color={AFTER_CARDS_COLOR} label="After cards" dashed /> : null}
				{freeCash > 0 ? <LegendItem color="var(--chart-fill-green)" label="Free" block /> : null}
			</div>
		</div>
	);
}

function LineLabel({ x, y, fill, children }: { x: number; y: number; fill: string; children: string }) {
	return (
		<text x={x - 4} y={y - 6} textAnchor="end" fontSize={12} fontWeight={500} fill={fill} pointerEvents="none">
			{children}
		</text>
	);
}

function LegendItem({ color, label, dashed = false, block = false }: { color: string; label: string; dashed?: boolean; block?: boolean }) {
	return (
		<span className="flex items-center gap-2xs">
			<svg width="16" height="10" aria-hidden="true">
				{block ? (
					<rect width="16" height="10" rx="2" fill={color} fillOpacity={0.35} />
				) : (
					<line x1="0" x2="16" y1="5" y2="5" stroke={color} strokeWidth={dashed ? 2 : 3} strokeDasharray={dashed ? '4 3' : undefined} />
				)}
			</svg>
			{label}
		</span>
	);
}

function Dot({ x, y, fill }: { x: number; y: number; fill: string }) {
	return <circle cx={x} cy={y} r={5.5} fill={fill} stroke="var(--background-primary)" strokeWidth={2} pointerEvents="none" />;
}

function EventMarker({ marker, x, y, plotBottom }: { marker: Marker; x: number; y: number; plotBottom: number }) {
	const colors = MARKER_COLORS[marker.kind];
	const half = MARKER_SIZE / 2;
	return (
		<g pointerEvents="none">
			<line x1={x} x2={x} y1={y + MARKER_SIZE} y2={plotBottom} stroke="var(--divider-secondary)" />
			<rect x={x - half} y={y} width={MARKER_SIZE} height={MARKER_SIZE} rx={6} fill={colors.background} stroke="var(--background-primary)" strokeWidth={2} />
			{marker.kind === 'income' || marker.kind === 'cardMaxedOut' || marker.kind === 'outOfCash' || marker.kind === 'cushionUsed' ? (
				<text x={x} y={y + half} dy="0.36em" textAnchor="middle" fontSize={13} fontWeight={600} fill={colors.foreground}>
					{marker.kind === 'income' ? '$' : '!'}
				</text>
			) : (
				<>
					<rect x={x - 5.5} y={y + 6} width={11} height={8} rx={1.5} fill="none" stroke={colors.foreground} strokeWidth={1.5} />
					<line x1={x - 5.5} x2={x + 5.5} y1={y + 9} y2={y + 9} stroke={colors.foreground} strokeWidth={1.5} />
				</>
			)}
		</g>
	);
}

/** Places the tooltip beside the hovered day instead of over it. */
function tooltipPosition(x: number, pointerY: number, width: number): { left: number; top: number } {
	const fitsRight = x + TOOLTIP_GAP + TOOLTIP_WIDTH <= width;
	return {
		left: fitsRight ? x + TOOLTIP_GAP : Math.max(0, x - TOOLTIP_GAP - TOOLTIP_WIDTH),
		top: Math.min(Math.max(0, pointerY - TOOLTIP_TALLEST / 2), HEIGHT - TOOLTIP_TALLEST)
	};
}

function DayTooltip({ day, events, left, top, width, formatter }: { day: ProjectedDay; events: ProjectionEvent[]; left: number; top: number; width: number; formatter: Formatter }) {
	const named = day.flows.filter(flow => flow.accountId === undefined && flow.kind !== 'spending').sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	const spending = day.flows.filter(flow => flow.accountId === undefined && flow.kind === 'spending').reduce((total, flow) => total + flow.amount, 0);
	const shown: ScheduledFlow[] = named.slice(0, MAX_TOOLTIP_FLOWS);

	return (
		<div data-theme="dark" className="pointer-events-none absolute z-tooltip" style={{ left, top, width }}>
			<div className="flex flex-col gap-xs rounded-lg bg-background-primary p-default text-content-primary shadow-lg">
				<span className="text-xs font-medium text-content-secondary">{formatter.longDate(day.date)}</span>
				<span className="text-base font-medium">{formatter.money(day.checking)}</span>
				{day.lowestChecking < day.checking ? <FlowRow label="Lowest during the day" amount={day.lowestChecking} formatter={formatter} plain /> : null}
				{day.cardsOwed > 0 ? <FlowRow label="After cards" amount={afterCardsOf(day)} formatter={formatter} plain /> : null}
				{events.map(event => (
					<span key={`${event.kind}-${event.label}-${event.date}`} className="text-xs font-medium text-content-danger">
						{event.label}
					</span>
				))}
				{shown.map((flow, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: two flows can share a label and amount on a day, and a day's flows never reorder while shown.
					<FlowRow key={index} label={flow.label} amount={flow.amount} formatter={formatter} />
				))}
				{named.length > shown.length ? <span className="text-xs text-content-secondary">{`${named.length - shown.length} more`}</span> : null}
				{spending ? <FlowRow label="Everyday spending" amount={spending} formatter={formatter} /> : null}
			</div>
		</div>
	);
}

function FlowRow({ label, amount, formatter, plain = false }: { label: string; amount: number; formatter: Formatter; plain?: boolean }) {
	return (
		<div className="flex items-baseline justify-between gap-sm text-xs">
			<span className="min-w-0 truncate text-content-secondary">{label}</span>
			<span className={`shrink-0 font-medium ${amount > 0 && !plain ? 'text-content-success' : 'text-content-primary'}`}>{`${amount > 0 && !plain ? '+' : ''}${formatter.money(amount)}`}</span>
		</div>
	);
}

function markersOf(days: ProjectedDay[], events: ProjectionEvent[]): Marker[] {
	const indexByDate = new Map(days.map((day, index) => [day.date, index]));
	const flowMarkers =
		days.length > MAX_MARKED_DAYS
			? []
			: days.flatMap((day, index) => {
					const checkingFlows = day.flows.filter(flow => flow.accountId === undefined);
					const markers: Marker[] = [];
					if (checkingFlows.some(flow => flow.kind === 'income')) markers.push({ kind: 'income', index });
					if (checkingFlows.some(flow => flow.kind === 'cardPayment')) markers.push({ kind: 'cardPayment', index });
					return markers;
				});
	const eventMarkers = events.flatMap((event): Marker[] => {
		const index = indexByDate.get(event.date);
		return index === undefined ? [] : [{ kind: event.kind, index }];
	});
	return [...eventMarkers, ...flowMarkers];
}

function niceTicks(low: number, high: number): number[] {
	const span = high - low || Math.abs(high) || 1;
	const rawStep = span / (TARGET_Y_TICKS - 1);
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step = ([1, 2, 2.5, 5, 10].find(multiple => multiple * magnitude >= rawStep) ?? 10) * magnitude;
	const ticks: number[] = [];
	for (let tick = Math.floor(low / step) * step; tick <= high + step / 2; tick += step) ticks.push(Math.round(tick * 100) / 100);
	return ticks.length > 1 ? ticks : [ticks[0] ?? 0, (ticks[0] ?? 0) + step];
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		setWidth(element.clientWidth);
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return width;
}
