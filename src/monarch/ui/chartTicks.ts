import { roundToCents } from '../../common/money';

/**
 * Round amounts for a chart's gridlines, about `targetCount` of them, from at or below `low` to at or above `high`, so
 * the plotted line never runs past the top or bottom gridline.
 */
export function niceTicks(low: number, high: number, targetCount: number): number[] {
	const span = high - low || Math.abs(high) || 1;
	const rawStep = span / (targetCount - 1);
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step = ([1, 2, 2.5, 5, 10].find(multiple => multiple * magnitude >= rawStep) ?? 10) * magnitude;
	const ticks: number[] = [];
	let tick = Math.floor(low / step) * step;
	while (ticks.length < 2 || tick - step < high) {
		ticks.push(roundToCents(tick));
		tick += step;
	}
	return ticks;
}
