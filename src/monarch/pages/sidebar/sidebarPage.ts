import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const SIDEBAR_SELECTOR = '[data-external-id="side-bar"]';
const HEADER_LINK_SELECTOR = '[data-external-id="header-link"]';
const NAV_LINK_SELECTOR = 'a[data-external-id="nav-bar-link"]';
/** Monarch marks the link to the page you're on. */
const ACTIVE_CLASS = 'active';
/** The padding Monarch's nav section has, without its fill and scroll, so the links stay below the row. */
const ROW_CLASS = 'flex flex-col p-sm pt-0 pr-0';

/** Styling copied from Monarch's sidebar, so a Wingspan row there looks and collapses like its own. */
export interface SidebarStyles {
	/** A nav link, not marked as the current page. */
	linkClassName: string;
	/** The icon box at the start of a nav link. */
	iconClassName: string;
}

/*
 * Monarch's left sidebar, on every page. It's collapsed to icons unless hovered or pinned open; the sidebar's
 * aria-expanded tells its rows which.
 *
 * +- side-bar ------------------+
 * | [M] header-link    [pin]    |
 * | +- Wingspan's row -------+  |
 * | | [ render(hostEl) ]     |  |
 * | +------------------------+  |
 * | Dashboard                   |
 * | Accounts ...                |
 * +-----------------------------+
 */
export class SidebarPage {
	private row: MountedSlot | null = null;

	public constructor(private readonly document: Document) {}

	/** Null until Monarch's sidebar has rendered its links. */
	public get styles(): SidebarStyles | null {
		const linkEl = this.document.querySelector<HTMLElement>(`${SIDEBAR_SELECTOR} ${NAV_LINK_SELECTOR}`);
		const iconEl = linkEl?.firstElementChild;
		if (!linkEl || !iconEl) return null;
		return {
			linkClassName: [...linkEl.classList].filter(className => className !== ACTIVE_CLASS).join(' '),
			iconClassName: iconEl.getAttribute('class') ?? ''
		};
	}

	/**
	 * Where a Wingspan menu from the sidebar renders. Inside the sidebar, so moving onto the menu still counts as
	 * hovering it and Monarch keeps it open.
	 */
	public get menuContainer(): HTMLElement | null {
		return this.document.querySelector<HTMLElement>(SIDEBAR_SELECTOR);
	}

	/** Puts the row just below Monarch's logo, or removes it while the sidebar isn't there. */
	public showRow(content: SlotContent): void {
		const headerEl = this.document.querySelector(`${SIDEBAR_SELECTOR} ${HEADER_LINK_SELECTOR}`)?.parentElement;
		if (!headerEl) {
			this.removeRow();
			return;
		}

		this.row ??= MountedSlot.mount(this.document, content, WingspanAttribute.workspaceSwitcher, { className: ROW_CLASS });
		if (headerEl.nextElementSibling !== this.row.hostEl) headerEl.after(this.row.hostEl);
	}

	public removeRow(): void {
		this.row?.remove();
		this.row = null;
	}
}
