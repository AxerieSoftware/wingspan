import { StyleOverrides } from '../../ui/styleOverrides';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

const STATEMENTS_LABEL = 'Statements';
/** What Monarch shows for Statements until it has any. */
export const COMING_SOON_TEXT = 'Coming soon';
const PANEL_STYLE = 'position: absolute; inset: 0; z-index: 1;';
const SUMMARY_STATEMENTS_STYLE = 'align-self: stretch;';

/** The column beside the list: Monarch's month summary, or an item's detail panel. */
export class RecurringV2Sidebar {
	private readonly panelStyles = new StyleOverrides();
	private readonly summaryStyles = new StyleOverrides();
	private panel: MountedSlot | null = null;
	private summaryStatements: MountedSlot | null = null;

	public constructor(private readonly document: Document) {}

	/** Covers Monarch's summary while Monarch's own detail panel is closed. */
	public showPanel(panelContent: SlotContent): void {
		this.panel ??= MountedSlot.mount(this.document, panelContent, WingspanAttribute.detail, { className: 'flex h-full flex-col pb-gutter', style: PANEL_STYLE });

		const sidebarEl = this.document.querySelector<HTMLElement>(SELECTORS.sidebar);
		if (!sidebarEl) return;
		if (sidebarEl.querySelector(SELECTORS.detailPanel)) {
			this.panel.hostEl.remove();
			return;
		}
		if (this.panel.hostEl.parentElement !== sidebarEl) sidebarEl.append(this.panel.hostEl);

		const summaryEl = sidebarEl.querySelector<HTMLElement>(SELECTORS.summary);
		if (summaryEl) this.panelStyles.set(summaryEl, 'visibility', 'hidden');
	}

	public contains(targetEl: Element): boolean {
		return this.panel?.hostEl.contains(targetEl) ?? false;
	}

	public removePanel(): void {
		this.panel?.remove();
		this.panel = null;
		this.panelStyles.restore();
	}

	public closeMonarchDetail(): void {
		this.document.querySelector<HTMLElement>(`${SELECTORS.detailPanel} ${SELECTORS.closeButton}`)?.click();
	}

	/** Replaces "Coming soon" on the summary's Statements line. */
	public showSummaryStatements(summaryContent: SlotContent): void {
		const comingSoonEl = this.findComingSoon();
		if (!comingSoonEl) {
			this.removeSummaryStatements();
			return;
		}

		this.summaryStyles.set(comingSoonEl, 'display', 'none');
		this.summaryStatements ??= MountedSlot.mount(this.document, summaryContent, WingspanAttribute.summaryStatements, {
			className: 'flex w-full flex-col items-start gap-2xs',
			style: SUMMARY_STATEMENTS_STYLE
		});
		if (this.summaryStatements.hostEl.previousElementSibling !== comingSoonEl) comingSoonEl.after(this.summaryStatements.hostEl);
	}

	public removeSummaryStatements(): void {
		this.summaryStatements?.remove();
		this.summaryStatements = null;
		this.summaryStyles.restore();
	}

	private findComingSoon(): HTMLElement | null {
		const summaryEl = this.document.querySelector<HTMLElement>(SELECTORS.summary);
		const summaryRowEls = [...(summaryEl?.querySelectorAll<HTMLElement>(SELECTORS.summaryRow) ?? [])];
		const statementsRowEl = summaryRowEls.find(rowEl => rowEl.querySelector('button')?.textContent?.includes(STATEMENTS_LABEL));
		return [...(statementsRowEl?.querySelectorAll<HTMLElement>('span') ?? [])].find(spanEl => spanEl.textContent?.trim() === COMING_SOON_TEXT) ?? null;
	}
}
