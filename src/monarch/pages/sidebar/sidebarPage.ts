import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const SIDEBAR_SELECTOR = '[data-external-id="side-bar"]';
const HEADER_LINK_SELECTOR = '[data-external-id="header-link"]';
const NAV_LINK_SELECTOR = 'a[data-external-id="nav-bar-link"]';
/** Page links, plus the buttons at the bottom like Help & Support, which reuse the link component without an href. */
const ITEM_SELECTOR = ':is([data-external-id="nav-bar-link"], [data-external-id="sidebar-persistent-assistant"])';
/** Buttons have no href, so they're identified by their icon, which stays put when Monarch rewords a label. */
const ICON_ID_PREFIX = 'icon:';
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

export interface SidebarItem {
	/** A link's path, or a button's icon. */
	id: string;
	label: string;
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

	/** Every item in the sidebar, including hidden ones. */
	public get items(): SidebarItem[] {
		return [...this.document.querySelectorAll(`${SIDEBAR_SELECTOR} ${ITEM_SELECTOR}`)].flatMap(itemEl => {
			const id = itemId(itemEl);
			const label = itemEl.querySelector(':scope > span')?.textContent?.trim();
			return id && label ? [{ id, label }] : [];
		});
	}

	/** A stylesheet, not inline styles, so it works before Monarch's app has rendered the sidebar and survives its re-renders. */
	public hideItems(itemIds: readonly string[]): void {
		let styleEl = this.document.querySelector(`style[${WingspanAttribute.hiddenSidebarItems}]`);
		if (!itemIds.length) {
			styleEl?.remove();
			return;
		}
		if (!styleEl) {
			styleEl = this.document.createElement('style');
			styleEl.setAttribute(WingspanAttribute.hiddenSidebarItems, '');
			this.document.documentElement.append(styleEl);
		}
		styleEl.textContent = `${itemIds.map(itemSelector).join(',\n')} { display: none !important; }`;
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

function itemId(itemEl: Element): string | null {
	const href = itemEl.getAttribute('href');
	if (href) return href;
	const icon = itemEl.querySelector('[data-mds-icon]')?.getAttribute('data-mds-icon');
	return icon ? `${ICON_ID_PREFIX}${icon}` : null;
}

function itemSelector(itemId: string): string {
	if (!itemId.startsWith(ICON_ID_PREFIX)) return `${SIDEBAR_SELECTOR} ${ITEM_SELECTOR}[href=${JSON.stringify(itemId)}]`;
	const icon = JSON.stringify(itemId.slice(ICON_ID_PREFIX.length));
	return `${SIDEBAR_SELECTOR} ${ITEM_SELECTOR}:not([href]):has([data-mds-icon=${icon}])`;
}
