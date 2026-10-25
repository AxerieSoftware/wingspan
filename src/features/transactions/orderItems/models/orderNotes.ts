import { toCents } from '../../../../common/money';

const ITEM_LINE = /^(\d+) x (.+) - \$([\d,]+(?:\.\d{1,2})?)$/;

/** One line of a synced order in a transaction's notes, like "2 x Paper Towels - $11.99", whose price is for one. */
export interface OrderItem {
	line: string;
	name: string;
	quantity: number;
	unitPrice: number;
}

/** A synced order's notes: its items, and the other lines every split keeps, like the order's link. */
export interface OrderNotes {
	items: OrderItem[];
	otherLines: string[];
	/** What's between lines, kept so rebuilt notes look like Monarch's. */
	separator: string;
}

/** The order in notes Monarch's retail sync wrote. */
export function parseOrderNotes(notes: string | null): OrderNotes {
	const text = notes ?? '';
	const lines = text
		.split(/\n+/)
		.map(line => line.trim())
		.filter(Boolean);
	const items: OrderItem[] = [];
	const otherLines: string[] = [];
	for (const line of lines) {
		const match = ITEM_LINE.exec(line);
		if (match) items.push({ line, name: match[2] ?? '', quantity: Number(match[1]), unitPrice: Number(match[3]?.replaceAll(',', '')) });
		else otherLines.push(line);
	}
	return { items, otherLines, separator: text.includes('\n\n') ? '\n\n' : '\n' };
}

/** What an item weighs in sharing out a charge: its quantity times its price, in cents. */
export function weightCentsOf(item: OrderItem): number {
	return item.quantity * toCents(item.unitPrice);
}

/** Notes for a split with these items, in Monarch's format, with the order's other lines after them. */
export function notesFor(items: readonly OrderItem[], order: OrderNotes): string {
	return [...items.map(item => item.line), ...order.otherLines].join(order.separator);
}
