import { StyleOverrides } from '../../ui/styleOverrides';
import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2LayoutCopier } from './recurringV2LayoutCopier';
import type { RecurringV2SectionCard } from './recurringV2SectionCards';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

const FALLBACK_HEADER_CLASS_NAME = 'grid items-center gap-lg px-default py-sm';
const FALLBACK_PANEL_CLASS_NAME = 'overflow-x-auto';
const SCROLL_TRANSFORM_PATTERN = /transform:[^;]*;?/;

export interface RecurringV2StatementsContent {
	columnLabels: string[];
	rowEls: HTMLElement[];
	footerText: string | null;
	emptyText: string;
}

interface StatementsParts {
	panelEl: HTMLElement;
	rowsEl: HTMLElement;
	headerEl: HTMLElement;
	counterEl: HTMLElement;
	footerEl: HTMLElement;
	footerTextEl: HTMLElement;
	emptyEl: HTMLElement;
	columnLabelsKey: string;
}

/** Wingspan's rows in Monarch's Statements card, in place of its "Coming soon". */
export class RecurringV2StatementsCard {
	private readonly styles = new StyleOverrides();
	private parts: StatementsParts | null = null;

	public constructor(
		private readonly document: Document,
		private readonly layoutCopier: RecurringV2LayoutCopier
	) {}

	public get isShowingComingSoon(): boolean {
		return this.document.querySelector(SELECTORS.comingSoon) !== null;
	}

	/** Puts the rows before "Coming soon" and hides it; rebuilds the parts only when the columns change. */
	public show(content: RecurringV2StatementsContent, layoutSection: RecurringV2SectionCard | null): void {
		const comingSoonEl = this.document.querySelector<HTMLElement>(SELECTORS.comingSoon);
		if (!comingSoonEl) {
			this.remove();
			return;
		}

		const columnLabelsKey = content.columnLabels.join('|');
		if (this.parts?.columnLabelsKey !== columnLabelsKey) this.parts = this.build(content.columnLabels, layoutSection);
		const { panelEl, rowsEl, headerEl, counterEl, footerEl, footerTextEl, emptyEl } = this.parts;

		if (panelEl.nextElementSibling !== comingSoonEl) comingSoonEl.before(panelEl);
		this.styles.set(comingSoonEl, 'display', 'none');

		const cardEl = comingSoonEl.parentElement;
		const headingEl = cardEl?.firstElementChild;
		if (cardEl && headingEl instanceof HTMLElement) {
			if (counterEl.parentElement !== headingEl) headingEl.append(counterEl);
			this.putHeadingInHeader(cardEl, headingEl, headerEl, layoutSection);
		}
		const rowCount = String(content.rowEls.length);
		if (counterEl.textContent !== rowCount) counterEl.textContent = rowCount;

		const footerText = content.footerText ?? '';
		if (footerTextEl.textContent !== footerText) footerTextEl.textContent = footerText;
		if (emptyEl.textContent !== content.emptyText) emptyEl.textContent = content.emptyText;
		const wantedEls = [headerEl, ...(content.rowEls.length ? content.rowEls : [emptyEl]), ...(footerText ? [footerEl] : [])];
		const isInOrder = wantedEls.length === rowsEl.children.length && wantedEls.every((wantedEl, index) => rowsEl.children[index] === wantedEl);
		if (!isInOrder) rowsEl.replaceChildren(...wantedEls);

		if (layoutSection) this.fit(layoutSection, this.parts);
	}

	public remove(): void {
		this.parts?.panelEl.remove();
		this.parts?.counterEl.remove();
		this.parts = null;
		this.styles.restore();
	}

	private build(columnLabels: string[], layoutSection: RecurringV2SectionCard | null): StatementsParts {
		this.remove();

		const headerEl = this.document.createElement('div');
		headerEl.className = layoutSection?.headerGridEl?.className ?? FALLBACK_HEADER_CLASS_NAME;
		// Monarch's header has a scroll-synced transform that shouldn't be copied.
		const headerStyle = layoutSection?.headerGridEl?.getAttribute('style')?.replace(SCROLL_TRANSFORM_PATTERN, '');
		if (headerStyle) headerEl.setAttribute('style', headerStyle);
		headerEl.append(this.document.createElement('span'), ...columnLabels.map(label => this.columnLabelEl(label)), this.document.createElement('span'));

		const rowsEl = this.document.createElement('div');
		rowsEl.className = 'border-t border-t-divider-primary';

		const panelEl = this.document.createElement('div');
		panelEl.className = layoutSection?.scrollEl.className ?? FALLBACK_PANEL_CLASS_NAME;
		panelEl.setAttribute(WingspanAttribute.statements, '');
		panelEl.append(rowsEl);

		const counterEl = this.document.createElement('span');
		counterEl.className = 'text-sm font-book text-content-secondary ml-1.5';
		counterEl.setAttribute(WingspanAttribute.statementsCount, '');

		const footerEl = this.document.createElement('div');
		footerEl.className = 'flex flex-wrap items-center gap-x-xs gap-y-2xs border-t border-t-divider-primary px-default py-sm text-sm font-book text-content-secondary';
		const footerTextEl = this.document.createElement('span');
		footerEl.append(footerTextEl);

		const emptyEl = this.document.createElement('p');
		emptyEl.className = 'my-0 px-default py-lg text-sm font-book text-content-secondary';

		return { panelEl, rowsEl, headerEl, counterEl, footerEl, footerTextEl, emptyEl, columnLabelsKey: columnLabels.join('|') };
	}

	/**
	 * Monarch's section cards put the title in the header row's first cell. The Statements title is kept as Monarch's
	 * original element so its info popover still works, and is positioned over that cell.
	 */
	private putHeadingInHeader(cardEl: HTMLElement, headingEl: HTMLElement, headerEl: HTMLElement, layoutSection: RecurringV2SectionCard | null): void {
		const headerHeight = `${layoutSection?.headerGridEl?.offsetHeight || headingEl.offsetHeight}px`;
		if (headerEl.style.minHeight !== headerHeight) headerEl.style.minHeight = headerHeight;
		this.styles.set(cardEl, 'position', 'relative');
		this.styles.set(headingEl, 'position', 'absolute');
		this.styles.set(headingEl, 'top', '0');
		this.styles.set(headingEl, 'left', '0');
		this.styles.set(headingEl, 'z-index', '1');
		this.styles.set(headingEl, 'height', headerHeight);
	}

	private columnLabelEl(label: string): HTMLElement {
		const labelEl = this.document.createElement('span');
		const alignment = label === 'History' ? 'text-center' : label === 'Amount' ? 'text-right' : '';
		labelEl.className = `text-sm font-medium text-content-secondary ${alignment}`;
		labelEl.textContent = label;
		return labelEl;
	}

	private fit(layoutSection: RecurringV2SectionCard, parts: StatementsParts): void {
		if (layoutSection.headerGridEl) this.layoutCopier.copy(layoutSection.headerGridEl, parts.headerEl, true);
		this.layoutCopier.copy(layoutSection.rowsEl, parts.rowsEl, false);
	}
}
