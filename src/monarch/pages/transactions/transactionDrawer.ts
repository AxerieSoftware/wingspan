import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const TRANSACTION_PATH = /^\/transactions\/([^/]+)$/;
const DRAWER_BODY_SELECTOR = '[data-external-id="transaction-drawer-body"]';
const FIELD_ROW_SELECTOR = '[data-external-id="field-row"]';

/*
 * Monarch's transaction details: a drawer at /transactions/<id>, opened from Transactions to review or edit one.
 *
 * +- Transaction details --------------+
 * | [Mark as reviewed]           [x]   |
 * | Merchant                  $902.36  |
 * | +- Wingspan's banner ------------+ |
 * | | [ render(bannerEl) ]           | |
 * | +--------------------------------+ |
 * | Date      Oct 14, 2026             |
 * | Category  Student Loan             |
 * | ...                                |
 * +------------------------------------+
 */
export class TransactionDrawer {
	private banner: MountedSlot | null = null;

	public constructor(
		private readonly window: Window,
		private readonly navigator: MonarchNavigator
	) {}

	/** The transaction whose details are open, or null. */
	public get transactionId(): string | null {
		return TRANSACTION_PATH.exec(this.navigator.path)?.[1] ?? null;
	}

	/** Puts the banner above the drawer's first field, where Monarch puts its own banners, or removes it while the drawer isn't there. */
	public showBanner(content: SlotContent): void {
		const firstFieldEl = this.window.document.querySelector(DRAWER_BODY_SELECTOR)?.querySelector<HTMLElement>(FIELD_ROW_SELECTOR);
		if (!firstFieldEl?.parentElement) {
			this.removeBanner();
			return;
		}

		// A new drawer means a different transaction, so the banner is recreated.
		if (!this.banner?.hostEl.isConnected) {
			this.removeBanner();
			this.banner = MountedSlot.mount(this.window.document, content, WingspanAttribute.transactionBanner, { className: 'mb-default' });
		}
		if (this.banner.hostEl.nextElementSibling !== firstFieldEl) firstFieldEl.before(this.banner.hostEl);
	}

	public removeBanner(): void {
		this.banner?.remove();
		this.banner = null;
	}
}
