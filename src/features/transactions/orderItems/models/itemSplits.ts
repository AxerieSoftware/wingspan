import { type OrderItem, weightCentsOf } from './orderNotes';

/** In place of a category, an item the charge didn't pay for, like one cancelled or swapped after the order. */
export const NOT_IN_CHARGE = '';

/** A split to save: one category, the items in it, and its share of the charge. */
export interface PlannedSplit {
	categoryId: string;
	items: OrderItem[];
	amountCents: number;
}

/**
 * One split per category, in the order given and then in the order items first name new ones, leaving out items not
 * in the charge. The charge is shared out by each item's quantity times price, the way Monarch's retail sync shares it,
 * with leftover cents going to the splits with the largest remainders.
 *
 * Invariants, in whole cents: the splits add up to the charge exactly, and each is within a cent of its exact share.
 */
export function planItemSplits(chargeCents: number, items: readonly OrderItem[], categoryIds: readonly string[], categoryOrder: readonly string[]): PlannedSplit[] {
	const itemsByCategory = new Map<string, OrderItem[]>(categoryOrder.map(categoryId => [categoryId, []]));
	items.forEach((item, index) => {
		const categoryId = categoryIds[index] ?? NOT_IN_CHARGE;
		if (categoryId === NOT_IN_CHARGE) return;
		itemsByCategory.set(categoryId, [...(itemsByCategory.get(categoryId) ?? []), item]);
	});
	const groups = [...itemsByCategory].filter(([, groupItems]) => groupItems.length > 0);
	const weights = groups.map(([, groupItems]) => groupItems.reduce((total, item) => total + weightCentsOf(item), 0));
	const amounts = shareByWeight(chargeCents, weights);
	return groups.map(([categoryId, groupItems], index) => ({ categoryId, items: groupItems, amountCents: amounts[index] ?? 0 }));
}

/** Largest-remainder shares of a whole number of cents, ties going to the earlier weight. */
function shareByWeight(totalCents: number, weights: readonly number[]): number[] {
	const totalWeight = weights.reduce((total, weight) => total + weight, 0);
	if (totalWeight <= 0) return weights.map(() => 0);
	const exact = weights.map(weight => (totalCents * weight) / totalWeight);
	const shares = exact.map(Math.floor);
	let leftover = totalCents - shares.reduce((total, share) => total + share, 0);
	const byRemainder = exact.map((amount, index) => ({ index, remainder: amount - Math.floor(amount) })).sort((first, second) => second.remainder - first.remainder || first.index - second.index);
	for (const { index } of byRemainder) {
		if (leftover <= 0) break;
		shares[index] = (shares[index] ?? 0) + 1;
		leftover--;
	}
	return shares;
}

/**
 * Each item's category now: the category of the split whose notes list it, matching each line once so two of the
 * same item can sit in different splits. An item no split lists isn't in the charge. Lines are compared as Monarch
 * saves notes, which turns characters like "™" into "TM" and non-breaking spaces into plain ones.
 */
export function categoriesOfItems(items: readonly OrderItem[], splits: readonly { categoryId: string; itemLines: readonly string[] }[]): string[] {
	const remaining = splits.map(split => split.itemLines.map(comparableLine));
	return items.map(item => {
		const line = comparableLine(item.line);
		const splitIndex = remaining.findIndex(lines => lines.includes(line));
		if (splitIndex === -1) return NOT_IN_CHARGE;
		const lines = remaining[splitIndex] ?? [];
		lines.splice(lines.indexOf(line), 1);
		return splits[splitIndex]?.categoryId ?? NOT_IN_CHARGE;
	});
}

function comparableLine(line: string): string {
	return line.normalize('NFKC').replace(/\s+/g, ' ');
}
