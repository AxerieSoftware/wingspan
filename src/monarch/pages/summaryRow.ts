import { MountedSlot, type SlotContent } from './mountedSlot';

const STATISTIC_CARD_SELECTOR = '[data-external-id="deprecated-statistic-card"]';
/** Matches Monarch's money format, as "-$1,250.00" or "$4,800". */
const MONEY_PATTERN = /^(-)?\$([\d,]+(?:\.\d+)?)$/;
/** Wingspan's cards in a row of totals, in the order they go after Monarch's. */
const SUMMARY_CARDS = ['loansPaidDown'] as const;

/** The classes of Monarch's own summary card and its parts, so Wingspan's card looks the same in every theme. */
export interface SummaryCardLook {
	cardClassName: string;
	valueClassName: string;
	labelRowClassName: string;
	labelClassName: string;
}

export type SummaryCard = (typeof SUMMARY_CARDS)[number];

/** A Monarch page with a row of totals that Wingspan adds cards to. */
export interface SummaryRowPage {
	readonly isActive: boolean;
	/** Null while the row hasn't rendered. */
	readonly summaryCardLook: SummaryCardLook | null;
	showSummaryCard(card: SummaryCard, content: SlotContent): void;
	removeSummaryCard(card: SummaryCard): void;
}

/** A row of Monarch's statistic cards, like the totals on Cash Flow and Reports. Wingspan's cards go after Monarch's. */
export class SummaryRow {
	private readonly cards = new Map<SummaryCard, MountedSlot>();

	public constructor(
		private readonly document: Document,
		private readonly rowSelector: string,
		private readonly ownAttribute: string
	) {}

	/** Null while the row hasn't rendered. */
	public get look(): SummaryCardLook | null {
		const monarchCardEl = this.monarchCards().at(-1);
		const valueEl = monarchCardEl?.firstElementChild;
		const labelRowEl = monarchCardEl?.lastElementChild;
		const labelEl = labelRowEl?.firstElementChild;
		if (!monarchCardEl || !valueEl || !labelRowEl || !labelEl) return null;
		return { cardClassName: monarchCardEl.className, valueClassName: valueEl.className, labelRowClassName: labelRowEl.className, labelClassName: labelEl.className };
	}

	/** The amount on Monarch's card with that label, as shown. Null when there's no such card or it isn't an amount. */
	public amountOf(label: string): number | null {
		const monarchCardEl = this.monarchCards().find(cardEl => cardEl.lastElementChild?.textContent?.trim() === label);
		const match = MONEY_PATTERN.exec(monarchCardEl?.firstElementChild?.textContent?.trim() ?? '');
		if (!match?.[2]) return null;
		const amount = Number(match[2].replaceAll(',', ''));
		return match[1] ? -amount : amount;
	}

	/** Puts the card after Monarch's and any of Wingspan's that come before it, or removes it while the row isn't there. */
	public showCard(card: SummaryCard, content: SlotContent): void {
		const rowEl = this.document.querySelector<HTMLElement>(this.rowSelector);
		if (!rowEl) {
			this.removeCard(card);
			return;
		}

		if (!this.cards.has(card)) {
			this.cards.set(card, MountedSlot.mount(this.document, content, this.ownAttribute, { style: 'display: flex; flex: 1 1 0%;' }));
		}
		const hostEls = SUMMARY_CARDS.flatMap(shownCard => this.cards.get(shownCard)?.hostEl ?? []);
		const isInOrder = hostEls.every((hostEl, index) => hostEl === rowEl.children[rowEl.children.length - hostEls.length + index]);
		if (!isInOrder) rowEl.append(...hostEls);
	}

	public removeCard(card: SummaryCard): void {
		this.cards.get(card)?.remove();
		this.cards.delete(card);
	}

	private monarchCards(): HTMLElement[] {
		return [...this.document.querySelectorAll<HTMLElement>(`${this.rowSelector} > ${STATISTIC_CARD_SELECTOR}`)];
	}
}
