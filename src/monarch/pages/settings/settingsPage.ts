import type { MonarchNavigator } from '../monarchNavigator';
import { WingspanAttribute } from '../wingspanAttributes';
import type { SettingsLink } from './models/settingsLink';
import type { SettingsPageCard } from './models/settingsPageCard';
import { SettingsCard } from './settingsCard';
import { SETTINGS_SELECTORS as SELECTORS } from './settingsSelectors';

const SETTINGS_PATH = '/settings';
const PAGE_COLUMN_CLASS_NAME = 'order-(--column-order) col-span-(--column-span) md:order-0 md:col-span-(--column-span-md)';
const PAGE_COLUMN_STYLE = '--column-span: 12; --column-order: 0; --column-span-md: 9;';
const PAGE_BODY_CLASS_NAME = 'm-xl';

/*
 * Monarch's Settings page: /settings/<slug>
 *
 * +- links column ---------------+  +- page column ------------------------------+
 * | +- SettingsCard -----------+ |  | +- SettingsCard (Monarch's own) ---------+ |
 * | | Account            title | |  | | Profile                                | |
 * | | Profile            links | |  | | Name   [ ... ]                         | |
 * | | Display                  | |  | | Email  [ ... ]                         | |
 * | +--------------------------+ |  | +----------------------------------------+ |
 * | +- SettingsCard -----------+ |  +--------------------------------------------+
 * | | Household                | |
 * | | General                  | |  On /settings/wingspan Monarch leaves out
 * | | Members                  | |  its page column, and Wingspan's goes there:
 * | +--------------------------+ |
 * | +- Wingspan's links card --+ |  +- Wingspan's page column -------------------+
 * | | Wingspan                 | |  | +- page card ----------------------------+ |
 * | | General         selected | |  | | Wingspan                               | |
 * | +--------------------------+ |  | | [ render(bodyEl) mounts here ]         | |
 * |  showLinksCard /             |  | +----------------------------------------+ |
 * |  removeLinksCard             |  |  showPageCard / removePageCard             |
 * +------------------------------+  +--------------------------------------------+
 *
 * Both Wingspan cards are copies of Monarch's last links card, so they
 * look like the rest.
 */
export class SettingsPage {
	private linksCard: SettingsCard | null = null;
	private titleBeforePageCard: string | null = null;
	private pageTitle: string | null = null;
	private pageColumnEl: HTMLElement | null = null;
	private unmountPageCard: (() => void) | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	public get isActive(): boolean {
		return this.navigator.isUnder(SETTINGS_PATH);
	}

	public isOpen(slug: string): boolean {
		return this.navigator.path === this.pathFor(slug);
	}

	public open(slug: string): void {
		this.navigator.navigateTo(this.pathFor(slug));
	}

	/** Adds Wingspan's links card below Monarch's, or removes it while Monarch's cards aren't there. */
	public showLinksCard(title: string, links: SettingsLink[]): void {
		const linksColumnEl = this.findLinksColumnEl();
		const monarchLinksCard = linksColumnEl ? this.lastMonarchLinksCard(linksColumnEl) : null;
		if (!linksColumnEl || !monarchLinksCard) {
			this.removeLinksCard();
			return;
		}

		if (!this.linksCard?.cardEl.isConnected) this.linksCard = this.createLinksCard(monarchLinksCard, title, links);
		if (!this.linksCard) return;

		if (this.linksCard.cardEl !== linksColumnEl.lastElementChild) linksColumnEl.append(this.linksCard.cardEl);
		this.linksCard.selectLink(this.navigator.path);
	}

	public removeLinksCard(): void {
		this.linksCard?.cardEl.remove();
		this.linksCard = null;
	}

	/** Puts Wingspan's page column beside the links and sets the tab title to the card's title. */
	public showPageCard(pageCard: SettingsPageCard): void {
		const linksColumnEl = this.findLinksColumnEl();
		const monarchLinksCard = linksColumnEl ? this.lastMonarchLinksCard(linksColumnEl) : null;
		if (!linksColumnEl || !monarchLinksCard) {
			this.removePageCard();
			return;
		}

		if (!this.pageColumnEl?.isConnected) {
			this.removePageCard();
			this.pageColumnEl = this.createPageColumn(monarchLinksCard, pageCard);
		}
		if (!this.pageColumnEl) return;

		if (this.pageColumnEl.previousElementSibling !== linksColumnEl) linksColumnEl.after(this.pageColumnEl);

		this.pageTitle = `${pageCard.title} Settings`;
		if (this.window.document.title === this.pageTitle) return;
		this.titleBeforePageCard ??= this.window.document.title;
		this.window.document.title = this.pageTitle;
	}

	/** Unmounts the page card and restores the tab title it replaced. */
	public removePageCard(): void {
		this.unmountPageCard?.();
		this.unmountPageCard = null;
		this.pageColumnEl?.remove();
		this.pageColumnEl = null;
		// Only restore while the title is still Wingspan's; if Monarch already set the next page's title, keep it.
		if (this.titleBeforePageCard !== null && this.window.document.title === this.pageTitle) this.window.document.title = this.titleBeforePageCard;
		this.titleBeforePageCard = null;
	}

	private findLinksColumnEl(): HTMLElement | null {
		const firstLinkEl = this.window.document.querySelector(`${SELECTORS.card} ${SELECTORS.cardLink}`);
		return firstLinkEl?.closest<HTMLElement>(SELECTORS.card)?.parentElement ?? null;
	}

	private lastMonarchLinksCard(linksColumnEl: HTMLElement): SettingsCard | null {
		const monarchCardEls = linksColumnEl.querySelectorAll<HTMLElement>(`:scope > ${SELECTORS.card}:not([${SettingsCard.ownCardAttribute}])`);
		const lastCardEl = [...monarchCardEls].at(-1);
		return lastCardEl ? new SettingsCard(lastCardEl) : null;
	}

	private pathFor(slug: string): string {
		return `${SETTINGS_PATH}/${slug}`;
	}

	private createLinksCard(monarchLinksCard: SettingsCard, title: string, links: SettingsLink[]): SettingsCard | null {
		const linksCard = monarchLinksCard.clone();
		const cardLinks = links.map(link => ({ label: link.label, path: this.pathFor(link.slug) }));
		if (!linksCard.replaceLinks(cardLinks, path => this.navigator.navigateTo(path))) return null;

		linksCard.markAsWingspanCard();
		linksCard.title = title;
		return linksCard;
	}

	private createPageColumn(monarchLinksCard: SettingsCard, pageCard: SettingsPageCard): HTMLElement | null {
		const card = monarchLinksCard.clone();
		const bodyEl = this.window.document.createElement('div');
		bodyEl.className = PAGE_BODY_CLASS_NAME;
		if (!card.replaceLinksWith(bodyEl)) return null;

		card.title = pageCard.title;

		const pageColumnEl = this.window.document.createElement('div');
		pageColumnEl.className = PAGE_COLUMN_CLASS_NAME;
		pageColumnEl.setAttribute('style', PAGE_COLUMN_STYLE);
		pageColumnEl.setAttribute(WingspanAttribute.pageColumn, '');
		pageColumnEl.append(card.cardEl);

		this.unmountPageCard = pageCard.render(bodyEl);
		return pageColumnEl;
	}
}
