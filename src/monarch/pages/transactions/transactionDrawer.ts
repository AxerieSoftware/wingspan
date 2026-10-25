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
 * | +- Wingspan's items -------------+ |
 * | | [ render(itemsEl) ]            | |
 * | +--------------------------------+ |
 * | Date      Oct 14, 2026             |
 * | Category  Student Loan             |
 * | ...                                |
 * +------------------------------------+
 */
/** Wingspan's parts above the drawer's first field, top to bottom. */
const SLOT_ATTRIBUTES = { banner: WingspanAttribute.transactionBanner, items: WingspanAttribute.transactionItems } as const;
type DrawerSlot = keyof typeof SLOT_ATTRIBUTES;
const SLOT_ORDER = Object.keys(SLOT_ATTRIBUTES) as DrawerSlot[];

export class TransactionDrawer {
	private readonly slots = new Map<DrawerSlot, MountedSlot>();

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
		this.show('banner', content);
	}

	public removeBanner(): void {
		this.remove('banner');
	}

	/** Puts the items right above the drawer's first field, below the banner, or removes them while the drawer isn't there. */
	public showItems(content: SlotContent): void {
		this.show('items', content);
	}

	public removeItems(): void {
		this.remove('items');
	}

	/** Keeps the slot above the next shown slot below it, or the first field, so slots never trade places. */
	private show(slot: DrawerSlot, content: SlotContent): void {
		const firstFieldEl = this.window.document.querySelector(DRAWER_BODY_SELECTOR)?.querySelector<HTMLElement>(FIELD_ROW_SELECTOR);
		if (!firstFieldEl?.parentElement) {
			this.remove(slot);
			return;
		}

		// A new drawer means a different transaction, so the slot is recreated.
		let mounted = this.slots.get(slot);
		if (!mounted?.hostEl.isConnected) {
			this.remove(slot);
			mounted = MountedSlot.mount(this.window.document, content, SLOT_ATTRIBUTES[slot], { className: 'mb-default' });
			this.slots.set(slot, mounted);
		}
		const nextEl =
			SLOT_ORDER.slice(SLOT_ORDER.indexOf(slot) + 1)
				.map(below => this.slots.get(below)?.hostEl)
				.find(hostEl => hostEl?.isConnected) ?? firstFieldEl;
		if (mounted.hostEl.nextElementSibling !== nextEl) nextEl.before(mounted.hostEl);
	}

	private remove(slot: DrawerSlot): void {
		this.slots.get(slot)?.remove();
		this.slots.delete(slot);
	}
}
