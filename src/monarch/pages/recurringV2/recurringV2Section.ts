import type { StyleOverrides } from '../../ui/styleOverrides';
import type { RecurringV2Row } from './recurringV2Row';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

const DATED_RANK = 0;
const UNDATED_RANK = 1;
const BEFORE_FIRST_ROW_RANK = 2;

/** A row and the non-row elements Monarch renders after it, which move with it. */
interface RowBlock {
	row: RecurringV2Row | null;
	date: string | null;
	blockEls: HTMLElement[];
	index: number;
}

/** The rows element of a section card, Monarch's or one Wingspan added. */
export class RecurringV2Section {
	public constructor(
		public readonly sectionEl: HTMLElement,
		private readonly rowFor: (rowEl: HTMLElement) => RecurringV2Row
	) {}

	/** Every row in the section, Monarch's and Wingspan's, in DOM order. */
	public get rows(): RecurringV2Row[] {
		return this.childEls.filter(childEl => childEl.matches(SELECTORS.rowButton)).map(rowEl => this.rowFor(rowEl));
	}

	/** Reorders with CSS `order`, leaving Monarch's DOM untouched. */
	public orderRows(dateFor: (row: RecurringV2Row) => string | null, styles: StyleOverrides, isHidden: (rowEl: HTMLElement) => boolean): void {
		styles.set(this.sectionEl, 'display', 'flex');
		styles.set(this.sectionEl, 'flex-direction', 'column');

		const blocks: RowBlock[] = [];
		for (const childEl of this.childEls) {
			if (childEl.matches(SELECTORS.rowButton)) {
				const row = this.rowFor(childEl);
				blocks.push({ row, date: dateFor(row), blockEls: [childEl], index: blocks.length });
				continue;
			}

			const previousBlock = blocks.at(-1);
			if (previousBlock) previousBlock.blockEls.push(childEl);
			else blocks.push({ row: null, date: null, blockEls: [childEl], index: 0 });
		}

		const orderedEls = blocks.sort((first, second) => this.compareBlocks(first, second)).flatMap(block => block.blockEls);
		let isFirstRow = true;
		orderedEls.forEach((orderedEl, position) => {
			styles.set(orderedEl, 'order', String(position));
			if (!orderedEl.matches(SELECTORS.rowButton) || isHidden(orderedEl)) return;

			// Monarch removes the top border from the first row in DOM order; it should be on the first visible row instead.
			styles.set(orderedEl, 'border-top-width', isFirstRow ? '0px' : '1px');
			isFirstRow = false;
		});
	}

	private get childEls(): HTMLElement[] {
		return [...this.sectionEl.children].filter((childEl): childEl is HTMLElement => childEl instanceof HTMLElement);
	}

	private compareBlocks(first: RowBlock, second: RowBlock): number {
		const byDate = first.date && second.date ? first.date.localeCompare(second.date) : 0;
		return this.rankOf(first) - this.rankOf(second) || byDate || first.index - second.index;
	}

	private rankOf(block: RowBlock): number {
		if (!block.row) return BEFORE_FIRST_ROW_RANK;
		return block.date ? DATED_RANK : UNDATED_RANK;
	}
}
