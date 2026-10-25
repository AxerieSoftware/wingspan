import { describe, expect, it } from 'vitest';
import { categoriesOfItems, NOT_IN_CHARGE, planItemSplits } from './itemSplits';
import { notesFor, parseOrderNotes, weightCentsOf } from './orderNotes';

const NOTES = [
	'1 x Fabrikam Espresso Maker - $167.99',
	'1 x Contoso Dish Soap Pods - 45ct - $14.89',
	'1 x Contoso Chocolate Sauce - $6.59',
	'2 x Contoso Paper Towels - 12 Rolls - $11.99',
	'1 x Fabrikam Coffee Pods - 10ct - $12.99',
	'https://www.example.com/orders/1001'
].join('\n\n');

describe("a synced order's notes", () => {
	it('reads each item with its quantity and price for one, and keeps the other lines for every split', () => {
		const order = parseOrderNotes(NOTES);

		expect(order.items.map(item => [item.name, item.quantity, item.unitPrice])).toEqual([
			['Fabrikam Espresso Maker', 1, 167.99],
			['Contoso Dish Soap Pods - 45ct', 1, 14.89],
			['Contoso Chocolate Sauce', 1, 6.59],
			['Contoso Paper Towels - 12 Rolls', 2, 11.99],
			['Fabrikam Coffee Pods - 10ct', 1, 12.99]
		]);
		expect(order.items.map(weightCentsOf)[3]).toBe(2398);
		expect(notesFor(order.items.slice(2, 3), order)).toBe('1 x Contoso Chocolate Sauce - $6.59\n\nhttps://www.example.com/orders/1001');
	});
});

describe('sharing a charge across the categories its items are in', () => {
	const { items } = parseOrderNotes(NOTES);

	// Invariant: the splits add up to the charge to the cent, each within a cent of its share by quantity times price.
	it("gives each category its items' share of the charge, adding up to the charge exactly", () => {
		const chargeCents = 13914;
		const categories = ['household', 'household', 'dining', 'household', 'groceries'];

		const splits = planItemSplits(chargeCents, items, categories, ['household', 'dining', 'groceries']);
		const totalWeight = items.reduce((total, item) => total + weightCentsOf(item), 0);

		expect(splits.map(split => split.categoryId)).toEqual(['household', 'dining', 'groceries']);
		expect(splits.reduce((total, split) => total + split.amountCents, 0)).toBe(chargeCents);
		for (const split of splits) {
			const exact = (chargeCents * split.items.reduce((total, item) => total + weightCentsOf(item), 0)) / totalWeight;
			expect(Math.abs(split.amountCents - exact)).toBeLessThan(1);
		}
	});

	// Invariant: an item not in the charge gets none of it, and the rest still add up to the charge to the cent.
	it('leaves an item not in the charge out of every split, sharing the charge across the rest', () => {
		const splits = planItemSplits(23943, items, [NOT_IN_CHARGE, 'household', 'dining', 'household', 'groceries'], ['household']);

		expect(splits.flatMap(split => split.items.map(item => item.name))).not.toContain('Fabrikam Espresso Maker');
		expect(splits.reduce((total, split) => total + split.amountCents, 0)).toBe(23943);
	});

	it("keeps the categories' order, adds new ones after it, and drops categories left with no items", () => {
		const splits = planItemSplits(1000, items, ['electronics', 'household', 'household', 'household', 'household'], ['household', 'dining']);

		expect(splits.map(split => split.categoryId)).toEqual(['household', 'electronics']);
	});
});

describe("each item's category now", () => {
	it('matches a line Monarch saved with "TM" for "™" and plain spaces for non-breaking ones', () => {
		const espresso = parseOrderNotes('1 x Fabrikam\u00a0Espresso Maker™ - $167.99').items;

		expect(categoriesOfItems(espresso, [{ categoryId: 'shopping', itemLines: ['1 x Fabrikam Espresso MakerTM - $167.99'] }])).toEqual(['shopping']);
	});

	it('is the category of the split whose notes list it, with two of the same item able to sit in different splits, and an item no split lists left out', () => {
		const pods = parseOrderNotes('1 x Fabrikam Coffee Pods - $12.99\n1 x Fabrikam Coffee Pods - $12.99\n1 x Contoso Napkins - $3.49').items;

		const categories = categoriesOfItems(pods, [
			{ categoryId: 'groceries', itemLines: ['1 x Fabrikam Coffee Pods - $12.99'] },
			{ categoryId: 'dining', itemLines: ['1 x Fabrikam Coffee Pods - $12.99'] }
		]);

		expect(categories).toEqual(['groceries', 'dining', NOT_IN_CHARGE]);
	});
});
