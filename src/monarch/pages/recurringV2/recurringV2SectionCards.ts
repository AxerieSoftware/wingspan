import type { StyleOverrides } from '../../ui/styleOverrides';
import { copyMonarchElement } from '../monarchCopy';
import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2LayoutCopier } from './recurringV2LayoutCopier';
import { SECTION_CARD_TEST_ID_PREFIX, SECTION_SCROLL_TEST_ID_PREFIX, RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

const OVERDUE_SECTION = 'Overdue';
const DEFAULT_COLUMN_LABELS = ['Status', 'History', 'Amount'];

/** A section card's parts: its name from the test id, the rows, the column header and the scroll area around the rows. */
export interface RecurringV2SectionCard {
	name: string;
	cardEl: HTMLElement;
	rowsEl: HTMLElement;
	headerGridEl: HTMLElement | null;
	scrollEl: HTMLElement;
}

/** The number beside a section's title. */
export const findSectionCountEl = (cardEl: HTMLElement): HTMLElement | null =>
	cardEl.querySelector(SELECTORS.headerGrid)?.firstElementChild?.querySelector<HTMLElement>(SELECTORS.sectionCount) ?? null;

/** Monarch's section cards, and the ones Wingspan adds for sections Monarch doesn't have. */
export class RecurringV2SectionCards {
	private readonly addedCardsByName = new Map<string, HTMLElement>();

	public constructor(
		private readonly document: Document,
		private readonly styles: StyleOverrides
	) {}

	public findMonarchCards(): RecurringV2SectionCard[] {
		return [...this.document.querySelectorAll<HTMLElement>(`${SELECTORS.sectionCard}:not([${WingspanAttribute.section}])`)].flatMap(cardEl => {
			const sectionCard = this.sectionCardFor(cardEl);
			return sectionCard ? [sectionCard] : [];
		});
	}

	/** The first of Monarch's rows in any card, for Wingspan's rows to copy, or null when there are none. */
	public sampleMonarchRowEl(monarchCards: RecurringV2SectionCard[]): HTMLElement | null {
		for (const sectionCard of monarchCards) {
			const rowEl = sectionCard.rowsEl.querySelector<HTMLElement>(`:scope > ${SELECTORS.monarchRow}`);
			if (rowEl) return rowEl;
		}

		return null;
	}

	/** The first card's column headings between the name and the menu, or Monarch's usual ones when it has no header. */
	public columnLabels(monarchCards: RecurringV2SectionCard[]): string[] {
		const headerGridEl = monarchCards[0]?.headerGridEl;
		if (!headerGridEl) return DEFAULT_COLUMN_LABELS;
		return [...headerGridEl.children].slice(1, -1).map(columnEl => columnEl.textContent?.trim() ?? '');
	}

	/** The rows element of the named section, Monarch's or one Wingspan adds; null when there's no card to copy. */
	public rowsElFor(sectionName: string, monarchCards: RecurringV2SectionCard[]): HTMLElement | null {
		const monarchCard = monarchCards.find(sectionCard => sectionCard.name === sectionName);
		if (monarchCard) return monarchCard.rowsEl;

		let addedCardEl = this.addedCardsByName.get(sectionName);
		if (!addedCardEl?.isConnected) {
			addedCardEl = this.addSectionCard(sectionName, monarchCards) ?? undefined;
			if (!addedCardEl) return null;
			this.addedCardsByName.set(sectionName, addedCardEl);
		}

		return addedCardEl.querySelector<HTMLElement>(SELECTORS.sectionRows);
	}

	/** Removes the added cards for other sections and updates the counts on the rest. */
	public keepOnly(sectionNames: Set<string>): void {
		for (const [sectionName, addedCardEl] of this.addedCardsByName) {
			if (sectionNames.has(sectionName)) {
				this.updateCount(addedCardEl);
				continue;
			}

			addedCardEl.remove();
			this.addedCardsByName.delete(sectionName);
		}
	}

	/** Monarch sizes its columns at layout time, so the added cards copy its first card's columns on every sync. */
	public fitAddedCards(modelCard: RecurringV2SectionCard | undefined, layoutCopier: RecurringV2LayoutCopier): void {
		if (!modelCard) return;
		for (const addedCardEl of this.addedCardsByName.values()) {
			const addedCard = this.sectionCardFor(addedCardEl);
			if (!addedCard) continue;
			if (modelCard.headerGridEl && addedCard.headerGridEl) layoutCopier.copy(modelCard.headerGridEl, addedCard.headerGridEl, false);
			layoutCopier.copy(modelCard.rowsEl, addedCard.rowsEl, false);
		}
	}

	public removeAll(): void {
		this.keepOnly(new Set());
	}

	private sectionCardFor(cardEl: HTMLElement): RecurringV2SectionCard | null {
		const name = cardEl.dataset.testid?.slice(SECTION_CARD_TEST_ID_PREFIX.length) ?? '';
		// Search within the card, since a section Wingspan added can have the same name as one Monarch adds later.
		const scrollEl = cardEl.querySelector<HTMLElement>(`[data-testid="${CSS.escape(SECTION_SCROLL_TEST_ID_PREFIX + name)}"]`);
		const rowsEl = scrollEl?.firstElementChild;
		if (!scrollEl || !(rowsEl instanceof HTMLElement)) return null;

		return { name, cardEl, rowsEl, headerGridEl: cardEl.querySelector<HTMLElement>(SELECTORS.headerGrid), scrollEl };
	}

	/** A copy of Monarch's last section card, emptied and renamed. */
	private addSectionCard(sectionName: string, monarchCards: RecurringV2SectionCard[]): HTMLElement | null {
		const modelCardEl = monarchCards.at(-1)?.cardEl;
		if (!modelCardEl) return null;

		const addedCardEl = copyMonarchElement(modelCardEl);
		addedCardEl.setAttribute(WingspanAttribute.section, '');
		addedCardEl.dataset.testid = SECTION_CARD_TEST_ID_PREFIX + sectionName;

		const scrollEl = addedCardEl.querySelector<HTMLElement>(SELECTORS.sectionScroll);
		const rowsEl = scrollEl?.firstElementChild;
		if (!scrollEl || !(rowsEl instanceof HTMLElement)) return null;

		scrollEl.dataset.testid = SECTION_SCROLL_TEST_ID_PREFIX + sectionName;
		rowsEl.replaceChildren();
		for (const siblingEl of [...(scrollEl.parentElement?.children ?? [])]) if (siblingEl !== scrollEl) siblingEl.remove();

		const headerGridEl = addedCardEl.querySelector<HTMLElement>(SELECTORS.headerGrid);
		// Monarch's header scrolls with its rows; the copy's header stays fixed.
		headerGridEl?.style.removeProperty('transform');
		const nameAreaEl = headerGridEl?.firstElementChild;
		const titleEl = nameAreaEl?.querySelector<HTMLElement>(SELECTORS.sectionTitle);
		if (titleEl) titleEl.textContent = sectionName;

		const collapseButtonEl = nameAreaEl?.querySelector<HTMLButtonElement>('button');
		if (collapseButtonEl) this.replaceCollapseButton(collapseButtonEl, scrollEl, sectionName);

		if (sectionName === OVERDUE_SECTION) monarchCards[0]?.cardEl.before(addedCardEl);
		else modelCardEl.after(addedCardEl);
		return addedCardEl;
	}

	/** Monarch's button is wired to its own section, so the copy needs its own handler. */
	private replaceCollapseButton(collapseButtonEl: HTMLButtonElement, scrollEl: HTMLElement, sectionName: string): void {
		const freshButtonEl = collapseButtonEl.cloneNode(true) as HTMLButtonElement;
		collapseButtonEl.replaceWith(freshButtonEl);
		// The accessible name and aria-expanded describe the button in both states.
		freshButtonEl.setAttribute('aria-label', sectionName);
		freshButtonEl.setAttribute('aria-expanded', 'true');
		freshButtonEl.addEventListener('click', () => {
			const bodyEl = scrollEl.parentElement;
			if (!bodyEl) return;

			const isExpanding = freshButtonEl.getAttribute('aria-expanded') === 'false';
			this.styles.set(bodyEl, 'display', isExpanding ? '' : 'none');
			freshButtonEl.setAttribute('aria-expanded', String(isExpanding));
		});
	}

	private updateCount(addedCardEl: HTMLElement): void {
		const counterEl = findSectionCountEl(addedCardEl);
		const rowCount = String(addedCardEl.querySelector(SELECTORS.sectionRows)?.childElementCount ?? 0);
		if (counterEl && counterEl.textContent !== rowCount) counterEl.textContent = rowCount;
	}
}
