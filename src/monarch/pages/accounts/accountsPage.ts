import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const ACCOUNTS_PATH = '/accounts';
/** Scoped to Accounts' header, since the page Monarch is leaving, like Transactions, can still show its own filter. */
const FILTER_BUTTON_SELECTOR = '[data-external-id="accounts-header-controls"] button:has([class*="BusinessEntityFilterButton__ButtonText"])';
const FILTER_POPOVER_SELECTOR = '[class*="BusinessEntityFilterButton__PopoverContent"]';
/** Monarch's popper wrapper around the menu, hidden while Wingspan picks so the menu never shows. */
const HIDDEN_POPOVER_CSS = `[data-popper-placement]:has(${FILTER_POPOVER_SELECTOR}) { visibility: hidden !important; }`;
const HOUSEHOLD_OPTION = 'Household';
/** Monarch's label for its filter while nothing is chosen, so every account shows. */
const UNFILTERED_LABEL = 'Business';
/** If the menu hasn't opened by then, Monarch changed it; give up and leave the page as Monarch shows it. */
const OPEN_TIMEOUT_MS = 2000;
/** One card per group of accounts, like Loans or Credit Cards, titled with the group's name. */
const GROUP_TITLE_SELECTOR = '[data-external-id="account-group-card"] span[class*="CardTitle"]';

export type HouseholdPick = 'waiting' | 'done';

/*
 * Monarch's Accounts page: /accounts. Its business filter is the page's own state: a link can open it on a business,
 * but nothing opens it on Household, so Household is picked in Monarch's own filter menu.
 *
 * [Sort] [Business v] [Filters] [Refresh all] [+ Add account]
 *         +------------------+
 *         | Contoso Pottery  |
 *         | Household        |
 *         +------------------+
 */
export class AccountsPage {
	private readonly groupNotes = new Map<string, MountedSlot>();
	private openedAt: number | null = null;
	private hidingStyleEl: HTMLStyleElement | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	public get isActive(): boolean {
		return this.navigator.isUnder(ACCOUNTS_PATH);
	}

	/** Whether this visit came from a link that already picked businesses, like Monarch's P&L. */
	public get hasChosenBusinesses(): boolean {
		const state: unknown = this.window.history.state;
		const userState = state && typeof state === 'object' && 'usr' in state ? state.usr : null;
		return !!userState && typeof userState === 'object' && 'businessEntityIds' in userState;
	}

	/**
	 * Picks Household in Monarch's business filter, out of sight, leaving an existing choice alone. Monarch opens its
	 * menu a frame after the click, so this runs again on each sync until it's done.
	 */
	public pickHousehold(): HouseholdPick {
		const document = this.window.document;
		const buttonEl = document.querySelector<HTMLElement>(FILTER_BUTTON_SELECTOR);
		if (!buttonEl) return 'waiting';

		if (this.openedAt === null) {
			if (labelOf(buttonEl) !== UNFILTERED_LABEL) return 'done';
			this.hidingStyleEl = document.createElement('style');
			this.hidingStyleEl.textContent = HIDDEN_POPOVER_CSS;
			document.head.append(this.hidingStyleEl);
			this.openedAt = Date.now();
			buttonEl.click();
			return 'waiting';
		}

		const popoverEl = document.querySelector<HTMLElement>(FILTER_POPOVER_SELECTOR);
		if (!popoverEl) {
			if (Date.now() - this.openedAt < OPEN_TIMEOUT_MS) return 'waiting';
			this.cancel();
			return 'done';
		}
		const optionEl = [...popoverEl.querySelectorAll<HTMLElement>('*')].find(descendantEl => descendantEl.children.length === 0 && labelOf(descendantEl) === HOUSEHOLD_OPTION);
		optionEl?.click();
		// Monarch's menu closes from its button.
		buttonEl.click();
		this.cancel();
		return 'done';
	}

	/** Puts Wingspan's note in each named group's header, after Monarch's change over time. Removes the notes of other groups. */
	public showGroupNotes(contentByGroupName: ReadonlyMap<string, SlotContent>): void {
		this.showGroupNotesCore(contentByGroupName);
	}

	public removeGroupNotes(): void {
		this.showGroupNotesCore(new Map());
	}

	/** Stops a pick in progress and stops hiding Monarch's menu. */
	public cancel(): void {
		this.openedAt = null;
		this.hidingStyleEl?.remove();
		this.hidingStyleEl = null;
	}

	private showGroupNotesCore(contentByGroupName: ReadonlyMap<string, SlotContent>): void {
		const headerElsByGroupName = new Map<string, HTMLElement>();
		if (this.isActive) {
			for (const titleEl of this.window.document.querySelectorAll<HTMLElement>(GROUP_TITLE_SELECTOR)) {
				if (titleEl.parentElement) headerElsByGroupName.set(titleEl.textContent?.trim() ?? '', titleEl.parentElement);
			}
		}

		for (const [groupName, note] of this.groupNotes) {
			if (contentByGroupName.has(groupName) && headerElsByGroupName.has(groupName)) continue;
			note.remove();
			this.groupNotes.delete(groupName);
		}

		for (const [groupName, content] of contentByGroupName) {
			const headerEl = headerElsByGroupName.get(groupName);
			if (!headerEl) continue;
			let note = this.groupNotes.get(groupName);
			if (!note) {
				note = MountedSlot.mount(this.window.document, content, WingspanAttribute.accountGroupNote, { tagName: 'span', className: 'flex items-center gap-2xs' });
				this.groupNotes.set(groupName, note);
			}
			if (note.hostEl !== headerEl.lastElementChild) headerEl.append(note.hostEl);
		}
	}
}

/** The element's text without the icon-font glyphs Monarch puts in its buttons. */
function labelOf(element: Element): string {
	return (element.textContent ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}
