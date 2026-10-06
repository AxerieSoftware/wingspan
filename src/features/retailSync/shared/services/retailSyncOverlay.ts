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

const MARK_SVG = `<svg class="mark" viewBox="0 0 128 128" width="28" height="28" fill="currentColor" aria-hidden="true">
	<polygon points="64,35 116,17 108,59 76,63 106,85 90,111 64,93 38,111 22,85 52,63 20,59 12,17" />
</svg>`;

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

	private mount(): void {
		const hostEl = this.document.createElement('div');
		hostEl.setAttribute(HOST_ATTRIBUTE, '');
		const root = hostEl.attachShadow({ mode: 'closed' });
		root.innerHTML = `<style>${STYLES}</style>
			<div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="title">
				<div class="card">
					${MARK_SVG}
					<p class="title" id="title"></p>
					<div class="spinner" aria-hidden="true"></div>
					<p class="progress" role="status"></p>
					<p class="note">Keep this tab open. It closes automatically when it's done.</p>
				</div>
			</div>`;
		this.progressEl = root.querySelector('.progress');
		const titleEl = root.querySelector('.title');
		if (titleEl) titleEl.textContent = this.title;
		this.document.documentElement.append(hostEl);
		this.hostEl = hostEl;
	}
}

/** For a page with no document to render on. */
export const NO_OVERLAY: SyncOverlay = { show: () => undefined, hide: () => undefined };
