import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const ACCOUNT_DETAILS_PATH = /^\/accounts\/details\/([^/]+)$/;
/** The main column, under the balance chart, holding the account's transactions or holdings. */
const MAIN_COLUMN_SELECTOR = '[data-external-id="grid-item"][style*="grid-area: rec"]';

/*
 * Monarch's page for one account: /accounts/details/<id>
 *
 * +- grid ------------------------------------------+
 * | chart   balance over time                       |
 * | rec     +- Wingspan's card ----+  | sum  Summary |
 * |         | [ render(cardEl) ]   |  |      Connection status
 * |         +----------------------+  |              |
 * |         Transactions or Holdings  |              |
 * +-------------------------------------------------+
 */
export class AccountDetailsPage {
	private card: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	/** The account shown, or null on other pages, including the account's edit and add-transaction pages. */
	public get accountId(): string | null {
		return ACCOUNT_DETAILS_PATH.exec(this.navigator.path)?.[1] ?? null;
	}

	/** Opens Monarch's details for the transaction, where its notes, tags and attachments are edited. */
	public openTransaction(transactionId: string): void {
		this.navigator.navigateTo(`/transactions/${transactionId}`);
	}

	/** Puts Wingspan's card first in the main column, or removes it while the column isn't there. */
	public showCard(content: SlotContent): void {
		const mainColumnEl = this.window.document.querySelector<HTMLElement>(MAIN_COLUMN_SELECTOR);
		if (!mainColumnEl) {
			this.removeCard();
			return;
		}

		this.card ??= MountedSlot.mount(this.window.document, content, WingspanAttribute.accountCard, { style: 'margin-bottom: var(--grid-spacing);' });
		if (this.card.hostEl !== mainColumnEl.firstElementChild) mainColumnEl.prepend(this.card.hostEl);
	}

	public removeCard(): void {
		this.card?.remove();
		this.card = null;
	}
}
