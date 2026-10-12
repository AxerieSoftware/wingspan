import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const ACCOUNT_DETAILS_PATH = /^\/accounts\/details\/([^/]+)$/;
/** The main column, under the balance chart, holding the account's transactions or holdings. */
const MAIN_COLUMN_SELECTOR = '[data-external-id="grid-item"][style*="grid-area: rec"]';

/** Wingspan's cards on an account's page. Each shows on its own kind of account, so only one is there at a time. */
export type AccountCard = 'hsaReimbursements' | 'loanInterest';

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
	private readonly cards = new Map<AccountCard, MountedSlot>();

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

	/** Puts the card first in the main column, or removes it while the column isn't there. */
	public showCard(card: AccountCard, content: SlotContent): void {
		const mainColumnEl = this.window.document.querySelector<HTMLElement>(MAIN_COLUMN_SELECTOR);
		if (!mainColumnEl) {
			this.removeCard(card);
			return;
		}

		let mounted = this.cards.get(card);
		if (!mounted) {
			mounted = MountedSlot.mount(this.window.document, content, WingspanAttribute.accountCard, { style: 'margin-bottom: var(--grid-spacing);' });
			this.cards.set(card, mounted);
		}
		if (mounted.hostEl !== mainColumnEl.firstElementChild) mainColumnEl.prepend(mounted.hostEl);
	}

	public removeCard(card: AccountCard): void {
		this.cards.get(card)?.remove();
		this.cards.delete(card);
	}
}
