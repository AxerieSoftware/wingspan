import { parseMoney } from '../monarchText';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const CHART_SURFACE_SELECTOR = '.recharts-surface';
const CHART_WRAPPER_SELECTOR = '.recharts-wrapper';
const MONTH_LABEL_SELECTOR = '.recharts-xAxis-tick-labels text';
const AMOUNT_LABEL_SELECTOR = '.recharts-yAxis-tick-labels text';
const BAR_SELECTOR = '.recharts-bar-rectangle path';
const TOOLTIP_SELECTOR = '.recharts-tooltip-wrapper';
const TOOLTIP_ROW_SELECTOR = '[data-external-id="chart-tooltip-data-row"]';
/** Axis labels are compact amounts, like "-$4.5K" or "$18K". */
const AXIS_SUFFIX_PATTERN = /[KMB]$/;
const AXIS_MULTIPLIERS: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
/** Recharts draws a bar's edge a fraction of a pixel off the line it sits on. */
const EDGE_TOLERANCE_PX = 1;

/** One month's column in Monarch's bar chart, in the chart's own SVG coordinates. */
export interface ChartColumn {
	chartWidth: number;
	chartHeight: number;
	left: number;
	barWidth: number;
	pixelsPerDollar: number;
	/** The plot's top and bottom, where the axis's highest and lowest amounts sit. */
	plotTop: number;
	plotBottom: number;
	/** The top of the income bar, or the $0 line when there's no income yet. */
	incomeTop: number;
	/** The bottom of the expenses bar, or the $0 line when there are no expenses yet. */
	expensesBottom: number;
	incomeColor: string;
	expensesColor: string;
}

/** The classes of a row in Monarch's chart tooltip, so Wingspan's rows look the same in every theme. */
export interface TooltipRowLook {
	rowClassName: string;
	iconClassName: string;
	labelClassName: string;
}

/** Monarch's tooltip for the month the pointer is over. */
export interface ChartTooltip {
	/** As Monarch shows it, like "October 2026". */
	heading: string;
	/** The amounts on its rows by label, like "Income" and "Expenses". */
	amounts: ReadonlyMap<string, number>;
	look: TooltipRowLook;
}

/*
 * Monarch's Cash Flow bar chart: a Recharts SVG with a column per month, income above $0 and expenses below.
 *
 * +- .recharts-wrapper --------------------------------+
 * | <svg> bars, $0 line, axes                          |
 * | +- Wingspan's overlay, same size, over the bars -+ |
 * | | [ render(overlayEl) mounts here ]              | |
 * | +------------------------------------------------+ |
 * | +- tooltip ---------------+                        |
 * | | October 2026            |                        |
 * | | Income: $1,015 ...      |                        |
 * | | [ Wingspan's rows ]     |                        |
 * | +-------------------------+                        |
 * +----------------------------------------------------+
 */
export class CashFlowChart {
	private overlay: MountedSlot | null = null;
	private tooltipRows: MountedSlot | null = null;

	public constructor(
		private readonly document: Document,
		/** The grid cell holding Monarch's chart, which also holds Wingspan's own section and its chart. */
		private readonly findCell: () => HTMLElement | null
	) {}

	/** Null while no tooltip shows. */
	public get tooltip(): ChartTooltip | null {
		const tooltipEl = this.tooltipElement();
		const rowEls = this.monarchTooltipRows();
		const firstRowEl = rowEls[0];
		const heading = firstRowEl?.parentElement?.previousElementSibling?.textContent?.trim();
		const iconEl = firstRowEl?.children[0];
		const labelEl = firstRowEl?.children[1];
		if (!tooltipEl || tooltipEl.style.visibility === 'hidden' || !firstRowEl || !heading || !iconEl || !labelEl) return null;

		const amounts = new Map(
			rowEls.flatMap(rowEl => {
				const label = rowEl.children[1]?.textContent?.trim().replace(/:$/, '');
				const amount = parseMoney(rowEl.children[2]?.textContent ?? '');
				return label && amount !== null ? [[label, amount] as const] : [];
			})
		);
		return { heading, amounts, look: { rowClassName: firstRowEl.className, iconClassName: iconEl.className, labelClassName: labelEl.className } };
	}

	/** The latest column with that axis label, like "Oct". Null while the chart hasn't drawn or has none. */
	/** The month the chart ends with, as its label reads, like "Oct", or null while there's no chart. */
	public get lastMonthLabel(): string | null {
		return [...(this.surface()?.querySelectorAll<SVGTextElement>(MONTH_LABEL_SELECTOR) ?? [])].at(-1)?.textContent?.trim() ?? null;
	}

	public column(monthLabel: string): ChartColumn | null {
		const surfaceEl = this.surface();
		if (!surfaceEl) return null;
		// The chart can show 13 months, so the same name twice; the column wanted is the latest.
		const labelEl = [...surfaceEl.querySelectorAll<SVGTextElement>(MONTH_LABEL_SELECTOR)].findLast(textEl => textEl.textContent?.trim() === monthLabel);
		const scale = this.scale(surfaceEl);
		const bars = [...surfaceEl.querySelectorAll<SVGPathElement>(BAR_SELECTOR)].map(barEl => ({ box: barEl.getBBox(), color: barEl.getAttribute('fill') ?? '' })).filter(bar => bar.box.height > 0);
		const zeroY = this.zeroLine(bars.map(bar => bar.box));
		const incomeBars = bars.filter(bar => Math.abs(bar.box.y + bar.box.height - zeroY) <= EDGE_TOLERANCE_PX);
		const expenseBars = bars.filter(bar => Math.abs(bar.box.y - zeroY) <= EDGE_TOLERANCE_PX);
		const barWidth = bars[0]?.box.width;
		if (!labelEl || !scale || !barWidth || !incomeBars[0] || !expenseBars[0]) return null;

		const center = Number(labelEl.getAttribute('x'));
		const isInColumn = (box: DOMRect) => Math.abs(box.x + box.width / 2 - center) < box.width / 2;
		const incomeBox = incomeBars.find(bar => isInColumn(bar.box))?.box;
		const expensesBox = expenseBars.find(bar => isInColumn(bar.box))?.box;
		return {
			chartWidth: Number(surfaceEl.getAttribute('width')),
			chartHeight: Number(surfaceEl.getAttribute('height')),
			left: center - barWidth / 2,
			barWidth,
			...scale,
			incomeTop: incomeBox ? incomeBox.y : zeroY,
			expensesBottom: expensesBox ? expensesBox.y + expensesBox.height : zeroY,
			incomeColor: incomeBars[0].color,
			expensesColor: expenseBars[0].color
		};
	}

	/** Puts Wingspan's overlay over the chart, or removes it while the chart isn't there. */
	public showOverlay(content: SlotContent): void {
		const wrapperEl = this.surface()?.closest<HTMLElement>(CHART_WRAPPER_SELECTOR);
		if (!wrapperEl) {
			this.removeOverlay();
			return;
		}

		this.overlay ??= MountedSlot.mount(this.document, content, WingspanAttribute.cashFlowChartOverlay, { style: 'position: absolute; inset: 0; pointer-events: none;' });
		if (this.overlay.hostEl.parentElement !== wrapperEl) wrapperEl.append(this.overlay.hostEl);
	}

	public removeOverlay(): void {
		this.overlay?.remove();
		this.overlay = null;
	}

	/** Adds Wingspan's rows after the tooltip's own, or removes them while no tooltip shows. */
	public showTooltipRows(content: SlotContent): void {
		const lastRowEl = this.monarchTooltipRows().at(-1);
		if (!lastRowEl) {
			this.removeTooltipRows();
			return;
		}

		this.tooltipRows ??= MountedSlot.mount(this.document, content, WingspanAttribute.cashFlowTooltipRows, { style: 'display: contents;' });
		if (lastRowEl.nextElementSibling !== this.tooltipRows.hostEl) lastRowEl.after(this.tooltipRows.hostEl);
	}

	public removeTooltipRows(): void {
		this.tooltipRows?.remove();
		this.tooltipRows = null;
	}

	private tooltipElement(): HTMLElement | null {
		return this.surface()?.closest(CHART_WRAPPER_SELECTOR)?.querySelector<HTMLElement>(TOOLTIP_SELECTOR) ?? null;
	}

	/** Monarch's chart, not the one in Wingspan's section below it. */
	private surface(): SVGSVGElement | null {
		return [...(this.findCell()?.querySelectorAll<SVGSVGElement>(CHART_SURFACE_SELECTOR) ?? [])].find(surfaceEl => !surfaceEl.closest(`[${WingspanAttribute.cashFlowSection}]`)) ?? null;
	}

	/** The tooltip's own rows, without Wingspan's. */
	private monarchTooltipRows(): HTMLElement[] {
		return [...(this.tooltipElement()?.querySelectorAll<HTMLElement>(TOOLTIP_ROW_SELECTOR) ?? [])].filter(rowEl => !rowEl.closest(`[${WingspanAttribute.cashFlowTooltipRows}]`));
	}

	/** From the top and bottom axis labels, the farthest apart, which gives the most precise scale despite the labels' rounding. */
	private scale(surfaceEl: SVGSVGElement): { pixelsPerDollar: number; plotTop: number; plotBottom: number } | null {
		const labels = [...surfaceEl.querySelectorAll<SVGTextElement>(AMOUNT_LABEL_SELECTOR)]
			.flatMap(textEl => {
				const amount = this.parseAxisAmount(textEl.textContent?.trim() ?? '');
				return amount === null ? [] : [{ amount, y: Number(textEl.getAttribute('y')) }];
			})
			.sort((a, b) => a.y - b.y);
		const top = labels[0];
		const bottom = labels.at(-1);
		if (!top || !bottom || top.amount === bottom.amount) return null;
		return { pixelsPerDollar: (bottom.y - top.y) / (top.amount - bottom.amount), plotTop: top.y, plotBottom: bottom.y };
	}

	/** Every bar has one edge on $0, income bars their bottom and expense bars their top, so it's the edge they share most. */
	private zeroLine(boxes: DOMRect[]): number {
		const countByEdge = new Map<number, number>();
		for (const box of boxes) {
			for (const edge of [box.y, box.y + box.height]) {
				const rounded = Math.round(edge);
				countByEdge.set(rounded, (countByEdge.get(rounded) ?? 0) + 1);
			}
		}
		return [...countByEdge].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [Number.NaN, 0])[0];
	}

	private parseAxisAmount(text: string): number | null {
		const suffix = AXIS_SUFFIX_PATTERN.exec(text)?.[0] ?? '';
		const amount = parseMoney(text.slice(0, text.length - suffix.length));
		return amount === null ? null : amount * (AXIS_MULTIPLIERS[suffix] ?? 1);
	}
}
