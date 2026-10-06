import { StyleOverrides } from '../../ui/styleOverrides';
import { copyMonarchElement } from '../monarchCopy';
import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2Item } from './models/recurringV2Item';
import type { RecurringV2Row } from './recurringV2Row';
import { type RecurringV2SectionCard, sectionCountEl } from './recurringV2SectionCards';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

/** A line of the month summary as Wingspan shows it: the text after its label, and its progress. */
export interface RecurringV2SummaryLine {
	texts: readonly string[];
	completed: number;
	total: number;
	completedText: string;
}

export type RecurringV2Summary = Record<'expense' | 'income', RecurringV2SummaryLine>;

export interface RecurringV2FilteredSection {
	card: RecurringV2SectionCard;
	rows: RecurringV2Row[];
}

const SUMMARY_LABELS = { expense: 'Expenses', income: 'Income' } as const;
const INACTIVE_FOOTER_PATTERN = /^(Show|Hide) (\d+) inactive (.+)$/;

/**
 * Hides some of Monarch's rows and updates the section counts and month summary to match. Monarch's own counts and
 * summary lines stay in the page, hidden, next to copies Wingspan keeps updated.
 */
export class RecurringV2EntityFilter {
	private readonly hiddenStyles = new StyleOverrides();
	private readonly textStyles = new StyleOverrides();
	private readonly summaryStyles = new StyleOverrides();
	private readonly ownTextEls = new Map<HTMLElement, HTMLElement>();
	private hiddenEls: ReadonlySet<HTMLElement> = new Set();
	private readonly ownSummaryEls = new Map<keyof RecurringV2Summary, HTMLElement>();

	public constructor(private readonly document: Document) {}

	/**
	 * `hiddenInactiveCount` gives, for the type in a section's "Show 15 inactive expenses" button, how many of those
	 * inactive items are hidden. Monarch doesn't render them until they're expanded, so they can't be counted from the page.
	 */
	public showOnly(sections: RecurringV2FilteredSection[], isShown: (item: RecurringV2Item) => boolean, hiddenInactiveCount: (kind: string) => number): void {
		const hiddenEls = new Set<HTMLElement>();
		const replacedEls = new Set<HTMLElement>();
		const hide = (targetEl: HTMLElement) => {
			this.hiddenStyles.set(targetEl, 'display', 'none');
			hiddenEls.add(targetEl);
		};

		for (const { card, rows } of sections) {
			const monarchRows = rows.filter(row => !row.isWingspanRow);
			const countEl = sectionCountEl(card.cardEl);
			// Monarch's count only includes active items, which are listed before any inactive ones.
			const activeCount = Number.parseInt(countEl?.textContent ?? '', 10);
			let shownActive = 0;
			let shownAny = rows.length > monarchRows.length;
			monarchRows.forEach((row, index) => {
				if (!isShown(row)) return hide(row.rowEl);
				shownAny = true;
				if (index < activeCount) shownActive++;
			});

			const footer = this.inactiveFooter(card.cardEl, hiddenInactiveCount);
			if (footer?.shownCount === 0) hide(footer.footerEl);
			else if (footer) {
				this.showOwnText(footer.labelEl, footer.label, WingspanAttribute.entityInactiveLabel);
				replacedEls.add(footer.labelEl);
			}
			if (!shownAny && !footer?.shownCount) hide(card.cardEl);
			if (countEl && Number.isFinite(activeCount)) {
				this.showOwnText(countEl, String(shownActive), WingspanAttribute.entityCount);
				replacedEls.add(countEl);
			}
		}

		this.hiddenStyles.restoreExcept(hiddenEls);
		this.hiddenEls = hiddenEls;
		this.textStyles.restoreExcept(replacedEls);
		for (const [monarchEl, ownEl] of this.ownTextEls) {
			if (replacedEls.has(monarchEl)) continue;
			ownEl.remove();
			this.ownTextEls.delete(monarchEl);
		}
	}

	public hides(targetEl: HTMLElement): boolean {
		return this.hiddenEls.has(targetEl);
	}

	/** Puts Wingspan's copy of each summary line after Monarch's and hides Monarch's. */
	public showSummary(summary: RecurringV2Summary): void {
		const summaryRowEls = [...this.document.querySelectorAll<HTMLElement>(`${SELECTORS.summary} ${SELECTORS.summaryRow}`)].filter(rowEl => !rowEl.hasAttribute(WingspanAttribute.entitySummary));
		for (const line of ['expense', 'income'] as const) {
			const monarchRowEl = summaryRowEls.find(rowEl => rowEl.querySelector(SELECTORS.summaryText)?.textContent?.trim() === SUMMARY_LABELS[line]);
			if (!monarchRowEl) {
				this.removeSummaryLine(line);
				continue;
			}

			let ownRowEl = this.ownSummaryEls.get(line);
			if (!ownRowEl?.isConnected) {
				ownRowEl = copyMonarchElement(monarchRowEl);
				ownRowEl.setAttribute(WingspanAttribute.entitySummary, line);
				this.ownSummaryEls.set(line, ownRowEl);
			}
			if (ownRowEl.previousElementSibling !== monarchRowEl) monarchRowEl.after(ownRowEl);
			this.summaryStyles.set(monarchRowEl, 'display', 'none');
			this.fillSummaryLine(ownRowEl, summary[line]);
		}
	}

	/** Removes Wingspan's summary lines and shows Monarch's again. */
	public removeSummary(): void {
		for (const line of [...this.ownSummaryEls.keys()]) this.removeSummaryLine(line);
		this.summaryStyles.restore();
	}

	/** Shows every row, count and summary line as Monarch has them. */
	public remove(): void {
		this.hiddenStyles.restore();
		this.hiddenEls = new Set();
		this.textStyles.restore();
		for (const ownEl of this.ownTextEls.values()) ownEl.remove();
		this.ownTextEls.clear();
		this.removeSummary();
	}

	private inactiveFooter(cardEl: HTMLElement, hiddenInactiveCount: (kind: string) => number): { footerEl: HTMLElement; labelEl: HTMLElement; label: string; shownCount: number } | null {
		const footerEl = cardEl.querySelector<HTMLElement>(SELECTORS.inactiveFooter);
		const labelEl = footerEl?.querySelector<HTMLElement>(SELECTORS.summaryText);
		const [, action, count, kind = ''] = INACTIVE_FOOTER_PATTERN.exec(labelEl?.textContent?.trim() ?? '') ?? [];
		if (!footerEl || !labelEl || !count) return null;

		const shownCount = Math.max(0, Number(count) - hiddenInactiveCount(kind));
		return { footerEl, labelEl, label: `${action} ${shownCount} inactive ${kind}`, shownCount };
	}

	/** Adds a copy of Monarch's element next to it with Wingspan's text, and hides Monarch's. */
	private showOwnText(monarchEl: HTMLElement, text: string, ownAttribute: string): void {
		let ownEl = this.ownTextEls.get(monarchEl);
		if (!ownEl?.isConnected) {
			ownEl = this.document.createElement('span');
			ownEl.className = monarchEl.className;
			ownEl.setAttribute(ownAttribute, '');
			this.ownTextEls.set(monarchEl, ownEl);
		}
		if (ownEl.previousElementSibling !== monarchEl) monarchEl.after(ownEl);
		if (ownEl.textContent !== text) ownEl.textContent = text;
		this.textStyles.set(monarchEl, 'display', 'none');
	}

	private removeSummaryLine(line: keyof RecurringV2Summary): void {
		this.ownSummaryEls.get(line)?.remove();
		this.ownSummaryEls.delete(line);
	}

	/** The copy's text after its label, in Monarch's order, and its progress meter for what's been paid or received. */
	private fillSummaryLine(rowEl: HTMLElement, line: RecurringV2SummaryLine): void {
		const amountEls = [...rowEl.querySelectorAll<HTMLElement>(SELECTORS.summaryText)].slice(1);
		line.texts.forEach((text, index) => {
			const amountEl = amountEls[index];
			if (amountEl && amountEl.textContent !== text) amountEl.textContent = text;
		});

		const meterEl = rowEl.querySelector<HTMLElement>(SELECTORS.meter);
		if (!meterEl) return;
		const [completed, total] = [Math.abs(line.completed), Math.abs(line.total)];
		meterEl.setAttribute('aria-valuenow', String(completed));
		meterEl.setAttribute('aria-valuemax', String(total));
		meterEl.setAttribute('aria-valuetext', line.completedText);
		const barEl = meterEl.querySelector<HTMLElement>(SELECTORS.meterBar);
		if (barEl) barEl.style.width = `${total ? Math.min(100, (completed / total) * 100) : 0}%`;
	}
}
