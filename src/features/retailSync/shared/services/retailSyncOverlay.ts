const HOST_ATTRIBUTE = 'data-wingspan-retail-overlay';

const STYLES = `
	:host { all: initial; }
	.backdrop {
		position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
		background: rgb(0 0 0 / 0.4); font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
	}
	.card {
		width: min(24rem, calc(100vw - 2rem)); box-sizing: border-box; padding: 1.5rem; border-radius: 0.75rem;
		background: #fff; color: #1a1616; box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.25);
		display: grid; gap: 0.75rem; justify-items: center; text-align: center;
	}
	.title { margin: 0; font-size: 1.0625rem; font-weight: 600; }
	.progress { margin: 0; font-size: 0.9375rem; }
	.note { margin: 0; font-size: 0.8125rem; color: #6b6663; }
	.mark { color: #ff692d; }
	.spinner { width: 1.75rem; height: 1.75rem; border-radius: 50%; border: 3px solid #f1ebe8; border-top-color: #ff692d; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
	@media (prefers-color-scheme: dark) {
		.card { background: #1f1d1c; color: #f4f1ef; }
		.note { color: #a8a29e; }
		.spinner { border-color: #3a3634; border-top-color: #ff692d; }
	}
`;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MARK_POINTS = '64,35 116,17 108,59 76,63 106,85 90,111 64,93 38,111 22,85 52,63 20,59 12,17';

/** Shows that Wingspan is working in the store's tab, and blocks clicks on the page while it reads. */
export interface SyncOverlay {
	show(progress: string): void;
	hide(): void;
}

/** Rendered over the store's page in its own shadow root, so styles don't leak either way. */
export class RetailSyncOverlay implements SyncOverlay {
	private hostEl: HTMLElement | null = null;
	private progressEl: HTMLElement | null = null;

	/** `title`, e.g. "Sending your Walmart purchases to Monarch". */
	public constructor(
		private readonly document: Document,
		private readonly title: string
	) {}

	/** Shows the overlay with progress below the title, adding it to the page if needed. */
	public show(progress: string): void {
		if (!this.hostEl?.isConnected) this.mount();
		if (this.progressEl) this.progressEl.textContent = progress;
	}

	public hide(): void {
		this.hostEl?.remove();
		this.hostEl = null;
		this.progressEl = null;
	}

	// Built element by element rather than from an HTML string, which Firefox's add-on review flags.
	private mount(): void {
		const hostEl = this.document.createElement('div');
		hostEl.setAttribute(HOST_ATTRIBUTE, '');
		const root = hostEl.attachShadow({ mode: 'closed' });

		const style = this.document.createElement('style');
		style.textContent = STYLES;
		const backdrop = this.element('div', 'backdrop');
		backdrop.setAttribute('role', 'dialog');
		backdrop.setAttribute('aria-modal', 'true');
		backdrop.setAttribute('aria-labelledby', 'title');
		const card = this.element('div', 'card');
		const title = this.element('p', 'title', this.title);
		title.id = 'title';
		const spinner = this.element('div', 'spinner');
		spinner.setAttribute('aria-hidden', 'true');
		const progress = this.element('p', 'progress');
		progress.setAttribute('role', 'status');
		const note = this.element('p', 'note', "Keep this tab open. It closes automatically when it's done.");
		card.append(this.mark(), title, spinner, progress, note);
		backdrop.append(card);
		root.append(style, backdrop);

		this.progressEl = progress;
		this.document.documentElement.append(hostEl);
		this.hostEl = hostEl;
	}

	private element(tagName: string, className: string, text?: string): HTMLElement {
		const element = this.document.createElement(tagName);
		element.className = className;
		if (text) element.textContent = text;
		return element;
	}

	private mark(): SVGElement {
		const svg = this.document.createElementNS(SVG_NAMESPACE, 'svg');
		for (const [name, value] of Object.entries({ class: 'mark', viewBox: '0 0 128 128', width: '28', height: '28', fill: 'currentColor', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
		const polygon = this.document.createElementNS(SVG_NAMESPACE, 'polygon');
		polygon.setAttribute('points', MARK_POINTS);
		svg.append(polygon);
		return svg;
	}
}

/** For a page with no document to render on. */
export const NO_OVERLAY: SyncOverlay = { show: () => undefined, hide: () => undefined };
