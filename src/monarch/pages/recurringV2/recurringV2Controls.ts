import { MountedSlot, type SlotContent } from '../mountedSlot';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

/** A Wingspan control in the button row above the list, just before Monarch's Filters. */
export class RecurringV2Controls {
	private control: MountedSlot | null = null;

	public constructor(private readonly document: Document) {}

	/** The styling of Monarch's Filters button, for a Wingspan button next to it. */
	public get buttonClassName(): string | undefined {
		return this.filtersEl()?.querySelector(SELECTORS.popoverTrigger)?.getAttribute('class') ?? undefined;
	}

	/** Puts the control just before Filters, or removes it while Filters isn't there. */
	public show(content: SlotContent, ownAttribute: string): void {
		const filtersEl = this.filtersEl();
		if (!filtersEl) {
			this.remove();
			return;
		}

		this.control ??= MountedSlot.mount(this.document, content, ownAttribute, { className: 'relative inline-flex' });
		if (this.control.hostEl.nextElementSibling !== filtersEl) filtersEl.before(this.control.hostEl);
	}

	public remove(): void {
		this.control?.remove();
		this.control = null;
	}

	/** The Filters button is the popover trigger among the controls, inside its own wrapper. */
	private filtersEl(): HTMLElement | null {
		const controlsEl = this.document.querySelector(SELECTORS.pageControls);
		return controlsEl?.querySelector<HTMLElement>(`:scope > * > ${SELECTORS.popoverTrigger}`)?.parentElement ?? null;
	}
}
