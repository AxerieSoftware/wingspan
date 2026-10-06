import { copyMonarchElement } from '../monarchCopy';
import { WingspanAttribute } from '../wingspanAttributes';
import { SETTINGS_SELECTORS as SELECTORS } from './settingsSelectors';

/** A link in a settings card: its text and the full path it opens. */
export interface SettingsCardLink {
	label: string;
	path: string;
}

/** One of Monarch's settings cards: a title over a list of links, or a page's body. */
export class SettingsCard {
	/** Marks the cards Wingspan adds, so they aren't taken for Monarch's. */
	public static readonly ownCardAttribute = WingspanAttribute.card;

	public constructor(public readonly cardEl: HTMLElement) {}

	public markAsWingspanCard(): void {
		this.cardEl.setAttribute(SettingsCard.ownCardAttribute, '');
	}

	/** The header's innermost text, or empty when the card has no header. */
	public get title(): string {
		return this.titleEl?.textContent ?? '';
	}

	/** Only writes when the text changes, to avoid touching Monarch's text node unnecessarily. */
	public set title(text: string) {
		const titleEl = this.titleEl;
		if (titleEl && titleEl.textContent !== text) titleEl.textContent = text;
	}

	public clone(): SettingsCard {
		return new SettingsCard(copyMonarchElement(this.cardEl));
	}

	/** Replaces the card's links with these, styled like the first one. Returns false when the card has no links to copy. */
	public replaceLinks(links: SettingsCardLink[], onOpen: (path: string) => void): boolean {
		const navEl = this.cardEl.querySelector<HTMLElement>(SELECTORS.cardNav);
		const templateLinkEl = navEl?.querySelector<HTMLAnchorElement>(SELECTORS.cardLink);
		if (!navEl || !templateLinkEl) return false;

		navEl.replaceChildren(...links.map(link => this.createLinkEl(templateLinkEl, link, onOpen)));
		return true;
	}

	/** Marks the link to this path selected and the others not, as Monarch does. */
	public selectLink(path: string): void {
		for (const linkEl of this.cardEl.querySelectorAll<HTMLAnchorElement>(SELECTORS.cardLink)) {
			const isSelected = linkEl.pathname === path;
			if (linkEl.hasAttribute('data-selected') !== isSelected) linkEl.toggleAttribute('data-selected', isSelected);
		}
	}

	/** Replaces the card's links with the body. Returns false when the card has no links. */
	public replaceLinksWith(bodyEl: HTMLElement): boolean {
		const navEl = this.cardEl.querySelector<HTMLElement>(SELECTORS.cardNav);
		if (!navEl) return false;

		navEl.replaceWith(bodyEl);
		return true;
	}

	private get titleEl(): HTMLElement | null {
		const headerEl = this.cardEl.querySelector(SELECTORS.cardHeader);
		return [...(headerEl?.querySelectorAll<HTMLElement>('*') ?? [])].find(descendantEl => descendantEl.childElementCount === 0) ?? null;
	}

	private createLinkEl(templateLinkEl: HTMLAnchorElement, link: SettingsCardLink, onOpen: (path: string) => void): HTMLAnchorElement {
		const linkEl = templateLinkEl.cloneNode(false) as HTMLAnchorElement;
		linkEl.removeAttribute('data-selected');
		linkEl.href = link.path;
		linkEl.textContent = link.label;
		linkEl.addEventListener('click', event => {
			// A modified click opens a new tab, as Monarch's own links do.
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
			event.preventDefault();
			onOpen(link.path);
		});
		linkEl.addEventListener('mouseenter', () => linkEl.setAttribute('data-highlighted', ''));
		linkEl.addEventListener('mouseleave', () => linkEl.removeAttribute('data-highlighted'));
		return linkEl;
	}
}
