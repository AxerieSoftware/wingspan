import type { MonarchNavigator } from '../monarchNavigator';
import { MountedSlot, type SlotContent } from '../mountedSlot';
import { WingspanAttribute } from '../wingspanAttributes';

const RECEIPTS_PATH = '/transactions/receipts';
const RETAIL_SYNC_PATH = '/transactions/retail-sync';
/** Monarch's Settings link at the right of the Transactions header, on its Receipts and Retail Sync tabs. */
const SETTINGS_LINK_SELECTOR = `[data-external-id="header"] a[href$="/settings"]`;

/** Transactions → Receipts and Retail Sync, where Monarch shows what it read from receipts and orders. */
export class ReceiptsPage {
	private control: MountedSlot | null = null;

	public constructor(
		private readonly document: Document,
		private readonly navigator: MonarchNavigator
	) {}

	/** True on the Receipts tab, not Retail Sync. */
	public get isShowingReceipts(): boolean {
		return this.navigator.path === RECEIPTS_PATH;
	}

	public openReceipts(): void {
		this.navigator.navigateTo(RECEIPTS_PATH);
	}

	public get isActive(): boolean {
		return this.navigator.path === RECEIPTS_PATH || this.navigator.path === RETAIL_SYNC_PATH;
	}

	/** The styling of Monarch's Settings button, for a Wingspan button next to it. */
	public get buttonClassName(): string | undefined {
		return this.document.querySelector(SETTINGS_LINK_SELECTOR)?.getAttribute('class') ?? undefined;
	}

	/** Shows the control just before Monarch's Settings link, or removes it while the header isn't there. */
	public showControl(content: SlotContent): void {
		const settingsEl = this.document.querySelector<HTMLElement>(SETTINGS_LINK_SELECTOR);
		if (!settingsEl) {
			this.removeControl();
			return;
		}
		if (!this.control?.hostEl.isConnected) {
			this.control?.remove();
			this.control = MountedSlot.mount(this.document, content, WingspanAttribute.retailSync, { className: 'flex items-center gap-xs' });
		}
		if (this.control.hostEl.nextElementSibling !== settingsEl) settingsEl.before(this.control.hostEl);
	}

	public removeControl(): void {
		this.control?.remove();
		this.control = null;
	}
}
