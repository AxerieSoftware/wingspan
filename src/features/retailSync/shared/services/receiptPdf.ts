import type { Formatter } from '../../../../monarch/ui/formatter';
import type { StoreReceipt } from '../models/storeReceipt';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
/** Courier is 0.6 em wide, so columns line up without measuring text. */
const COLUMNS = Math.floor((PAGE_WIDTH - 2 * MARGIN) / (FONT_SIZE * 0.6));
const AMOUNT_COLUMNS = 14;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN) / LINE_HEIGHT);
/** Replacements for characters PDF's standard fonts can't render. */
const PLAIN_CHARACTERS: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ' };

interface TextLine {
	text: string;
	bold?: boolean;
}

/** A plain text receipt laid out like a printed store receipt, for Monarch to parse. */
export class ReceiptPdf {
	public constructor(private readonly formatter: Formatter) {}

	/** File name like "walmart-2026-09-05-1234.pdf": the store, the date and the printed order id. */
	public fileName(receipt: StoreReceipt): string {
		return `${receipt.store.toLowerCase()}-${receipt.date}-${receipt.displayId.replace(/[^0-9A-Za-z-]/g, '')}.pdf`;
	}

	/** The receipt as PDF bytes, with as many pages as needed. */
	public render(receipt: StoreReceipt): Uint8Array<ArrayBuffer> {
		return this.document(this.lines(receipt));
	}

	private lines(receipt: StoreReceipt): TextLine[] {
		const money = (amount: number) => this.formatter.money(amount);
		const row = (label: string, amount: number, bold = false): TextLine => ({ text: this.columns(label, money(amount)), bold });
		const rule = { text: '-'.repeat(COLUMNS) };
		return [
			{ text: receipt.store, bold: true },
			{ text: `${receipt.referenceLabel} #${receipt.displayId}` },
			{ text: `Date: ${receipt.date}` },
			{ text: receipt.isInStore ? 'In-store purchase' : 'Online order' },
			{ text: '' },
			...receipt.items.flatMap(item => this.itemLines(item.quantity, item.name, money(item.amount))),
			rule,
			row('Subtotal', receipt.subtotal),
			...receipt.adjustments.map(line => row(line.label, line.amount)),
			row('Tax', receipt.tax),
			row('Total', receipt.total, true),
			{ text: '' },
			...(receipt.savings > 0 ? [{ text: `You saved ${money(receipt.savings)}, already in the total above.` }] : []),
			...receipt.payments.map(payment => ({ text: `Paid with ${payment}` }))
		];
	}

	/** Wraps the item name onto extra lines, with the amount on the first line. */
	private itemLines(quantity: number, name: string, amount: string): TextLine[] {
		const prefix = `${quantity} x `;
		const width = COLUMNS - AMOUNT_COLUMNS - prefix.length;
		const words = name.split(/\s+/);
		const wrapped: string[] = [];
		for (const word of words) {
			const last = wrapped.at(-1);
			if (last !== undefined && `${last} ${word}`.length <= width) wrapped[wrapped.length - 1] = `${last} ${word}`;
			else wrapped.push(word.slice(0, width));
		}
		return wrapped.map((part, index) => ({ text: index === 0 ? this.columns(prefix + part, amount) : ' '.repeat(prefix.length) + part }));
	}

	private columns(label: string, amount: string): string {
		const room = COLUMNS - amount.length - 1;
		return `${label.slice(0, room).padEnd(room)} ${amount}`;
	}

	/** A PDF 1.4 file using the standard Courier fonts, split into pages. */
	private document(lines: TextLine[]): Uint8Array<ArrayBuffer> {
		const pages: TextLine[][] = [];
		for (let start = 0; start < lines.length; start += LINES_PER_PAGE) pages.push(lines.slice(start, start + LINES_PER_PAGE));
		if (!pages.length) pages.push([]);

		// 1 catalog, 2 page tree, 3 and 4 fonts, then each page and its content stream.
		const pageIds = pages.map((_, index) => 5 + index * 2);
		const objects: string[] = [
			'<< /Type /Catalog /Pages 2 0 R >>',
			`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
			'<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
			'<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'
		];
		for (const [index, pageLines] of pages.entries()) {
			const contentId = (pageIds[index] as number) + 1;
			objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
			const stream = pageLines
				.map((line, row) => `BT /${line.bold ? 'F2' : 'F1'} ${FONT_SIZE} Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN - row * LINE_HEIGHT} Td (${this.pdfText(line.text)}) Tj ET`)
				.join('\n');
			objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		}

		let body = '%PDF-1.4\n';
		const offsets: number[] = [];
		for (const [index, object] of objects.entries()) {
			offsets.push(body.length);
			body += `${index + 1} 0 obj\n${object}\nendobj\n`;
		}
		const xrefOffset = body.length;
		body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
		body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
		// Every character is one byte, so lengths and offsets above count bytes.
		return Uint8Array.from(body, character => character.charCodeAt(0));
	}

	/** Latin-1 only, with PDF's special characters escaped; anything else becomes "?". */
	private pdfText(text: string): string {
		return [...text]
			.map(character => PLAIN_CHARACTERS[character] ?? character)
			.join('')
			.replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
			.replace(/[\\()]/g, special => `\\${special}`);
	}
}
