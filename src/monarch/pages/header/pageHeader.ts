import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const HEADER_SELECTOR = '[data-external-id="header"]';

/** Wingspan's notes in the header, in the order they're shown. */
const NOTE_ORDER = ['unfiltered', 'syncStatus'] as const;

export type PageHeaderNoteKey = (typeof NOTE_ORDER)[number];

/*
 * The header at the top of most of Monarch's pages: a grid with the title and tabs on the left and, on most pages,
 * a row of buttons on the right.
 *
 * +- header -------------------------------------------------------------+
 * | Goals  [Save up] [Pay down]        [ Wingspan's note ] [Manage] [Add] |
 * +----------------------------------------------------------------------+
 *
 * Notes go first in the button row, or in their own column at the right where there's no row.
 */
export class PageHeader {
	private readonly notes = new Map<PageHeaderNoteKey, MountedSlot>();

	public constructor(
		private readonly document: Document,
		private readonly navigator: MonarchNavigator
	) {}

	public get path(): string {
		return this.navigator.path;
	}

	/** Shows the note in the header, in `NOTE_ORDER` with Wingspan's other notes, or removes it while the page has no header. */
	public showNote(key: PageHeaderNoteKey, content: SlotContent): void {
		const headerEl = this.document.querySelector<HTMLElement>(HEADER_SELECTOR);
		if (!headerEl) {
			this.removeNote(key);
			return;
		}

		if (!this.notes.get(key)?.hostEl.isConnected) {
			this.removeNote(key);
			this.notes.set(key, MountedSlot.mount(this.document, content, WingspanAttribute.headerNote, { className: 'flex shrink-0 items-center', style: 'margin-right: var(--spacing-xs);' }));
		}

		const noteEls = NOTE_ORDER.flatMap(noteKey => this.notes.get(noteKey)?.hostEl ?? []);
		const buttonRowEl = headerEl.children.length > 1 ? headerEl.lastElementChild : null;
		if (buttonRowEl) {
			const firstEls = [...buttonRowEl.children].slice(0, noteEls.length);
			if (noteEls.some((noteEl, index) => noteEl !== firstEls[index])) buttonRowEl.prepend(...noteEls);
		} else {
			const lastEls = [...headerEl.children].slice(-noteEls.length);
			if (noteEls.some((noteEl, index) => noteEl !== lastEls[index])) headerEl.append(...noteEls);
		}
	}

	public removeNote(key: PageHeaderNoteKey): void {
		this.notes.get(key)?.remove();
		this.notes.delete(key);
	}
}
