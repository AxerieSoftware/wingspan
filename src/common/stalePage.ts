import { STALE_PARTS, WingspanAttribute } from '../monarch/pages/wingspanAttributes';
import { Layer } from '../monarch/ui/components/layer';
import type { ToastService } from '../monarch/ui/components/toast';

const STALE_MESSAGE = 'Wingspan was updated or disabled. Reload the page to continue.';
const STALE_SELECTOR = STALE_PARTS.map(attribute => `[${attribute}]`).join(',');

/** What the page shows after Wingspan is updated or disabled while it's open: Wingspan's UI grayed out and a toast to reload. */
export class StalePage {
	private styleElement: HTMLStyleElement | null = null;

	public constructor(
		private readonly document: Document,
		private readonly toastService: ToastService
	) {}

	/** Grays out and disables Wingspan's UI, closes its open popups and offers a reload. Calling it again does nothing. */
	public show(): void {
		if (this.styleElement) return;

		this.styleElement = this.document.createElement('style');
		this.styleElement.setAttribute(WingspanAttribute.stale, '');
		this.styleElement.textContent = `${STALE_SELECTOR} { opacity: 0.45 !important; filter: grayscale(1) !important; pointer-events: none !important; user-select: none !important; }`;
		this.document.head.append(this.styleElement);
		for (const staleElement of this.document.querySelectorAll<HTMLElement>(STALE_SELECTOR)) staleElement.inert = true;
		Layer.closeAll();
		this.toastService.showLast(STALE_MESSAGE, { label: 'Reload', onClick: () => this.document.location.reload() });
	}

	public hide(): void {
		if (!this.styleElement) return;

		for (const staleElement of this.document.querySelectorAll<HTMLElement>(STALE_SELECTOR)) staleElement.inert = false;
		this.styleElement.remove();
		this.styleElement = null;
	}
}
