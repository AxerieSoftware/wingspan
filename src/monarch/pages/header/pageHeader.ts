import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const HEADER_SELECTOR = '[data-external-id="header"]';

/*
 * The header at the top of most of Monarch's pages: a grid with the title and tabs on the left and, on most pages,
 * a row of buttons on the right.
 *
 * +- header -------------------------------------------------------------+
 * | Goals  [Save up] [Pay down]        [ Wingspan's note ] [Manage] [Add] |
 * +----------------------------------------------------------------------+
 *
 * The note goes first in the button row, or in its own column at the right where there's no row.
 */
export class PageHeader {
	private note: MountedSlot | null = null;

	public constructor(
		private readonly document: Document,
		private readonly navigator: MonarchNavigator
	) {}

	public get path(): string {
		return this.navigator.path;
	}

	/** Shows the note in the header, or removes it while the page has no header. */
	public showNote(content: SlotContent): void {
		const headerEl = this.document.querySelector<HTMLElement>(HEADER_SELECTOR);
		if (!headerEl) {
			this.removeNote();
			return;
		}

		this.note ??= MountedSlot.mount(this.document, content, WingspanAttribute.headerNote, { className: 'flex shrink-0 items-center', style: 'margin-right: var(--spacing-xs);' });
		const buttonRowEl = headerEl.children.length > 1 ? headerEl.lastElementChild : null;
		if (buttonRowEl) {
			if (buttonRowEl.firstElementChild !== this.note.hostEl) buttonRowEl.prepend(this.note.hostEl);
		} else if (headerEl.lastElementChild !== this.note.hostEl) {
			headerEl.append(this.note.hostEl);
		}
	}

	public removeNote(): void {
		this.note?.remove();
		this.note = null;
	}
}
