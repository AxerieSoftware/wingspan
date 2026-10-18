import { expect, type Locator, type Page } from '@playwright/test';

/** Mouse moves in this many steps, so the cursor glides to what it clicks. */
const CURSOR_STEPS = 28;
const CLICK_SETTLE_MS = 250;
const SCROLL_ATTEMPT_MS = 1000;
/** Room around a highlighted element, so the outline doesn't sit on its edge. */
const HIGHLIGHT_PADDING = 8;

/** `zoom` enlarges the caption and cursor for clips shown small on the site; `hasTitleCard` starts on the title card. */
export interface DemoOverlayOptions {
	zoom: number;
	hasTitleCard: boolean;
}

/**
 * Draws the demo video's cursor, click ripple, highlight, caption bar and title card on every page it opens. Runs in
 * the page, so it uses no imports.
 */
export function installDemoOverlay({ zoom, hasTitleCard }: DemoOverlayOptions) {
	const mark = (size: number) =>
		`<svg viewBox="0 0 128 128" width="${size}" height="${size}" aria-hidden="true"><polygon points="64,35 116,17 108,59 76,63 106,85 90,111 64,93 38,111 22,85 52,63 20,59 12,17" fill="#E8EAED"/></svg>`;
	const cursorSvg =
		'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z" fill="#111316" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/></svg>';

	const install = () => {
		if (document.getElementById('demo-overlay')) return;
		const style = document.createElement('style');
		style.textContent = `
			#demo-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
				font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
			#demo-caption, #demo-cursor svg { zoom: ${zoom}; }
			#demo-cursor { position: absolute; left: 50%; top: 55%; transform: translate(-4px, -2px); }
			.demo-ripple { position: absolute; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
				background: rgba(255, 105, 51, 0.35); animation: demo-ripple 450ms ease-out forwards; }
			@keyframes demo-ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
			#demo-highlight { position: absolute; border: 3px solid #FF6933; border-radius: 12px; opacity: 0;
				box-shadow: 0 0 0 6px rgba(255, 105, 51, 0.18); transition: opacity 250ms ease-out; }
			#demo-highlight.shown { opacity: 1; }
			#demo-caption { position: absolute; left: 50%; bottom: 32px; transform: translate(-50%, 12px); opacity: 0;
				display: flex; align-items: center; gap: 12px; width: max-content; max-width: calc(88vw / ${zoom}); padding: 12px 20px 12px 14px; border-radius: 14px;
				background: rgba(17, 19, 22, 0.92); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); color: #FFFFFF;
				font-size: 21px; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em; text-wrap: balance;
				transition: opacity 250ms ease-out, transform 250ms ease-out; }
			#demo-caption.shown { opacity: 1; transform: translate(-50%, 0); }
			#demo-caption.at-top { top: 32px; bottom: auto; }
			#demo-chip { white-space: nowrap; }
			#demo-caption svg { flex-shrink: 0; }
			#demo-chip { padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.14); color: #D2D6DB;
				font-size: 15px; font-weight: 600; letter-spacing: 0.02em; }
			#demo-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
				gap: 18px; background: #2F353C; color: #FFFFFF; text-align: center; transition: opacity 400ms ease-out; }
			#demo-card.hidden { opacity: 0; }
			#demo-card h1 { margin: 0; font-size: 64px; font-weight: 650; letter-spacing: -0.02em; }
			#demo-card p { margin: 0; color: #A7AFB8; font-size: 26px; font-weight: 500; }
			#demo-card small { margin-top: 18px; color: #8A929C; font-size: 16px; }`;
		const overlay = document.createElement('div');
		overlay.id = 'demo-overlay';
		overlay.innerHTML = `
			<div id="demo-highlight"></div>
			<div id="demo-caption">${mark(22)}<span id="demo-chip"></span><span id="demo-text"></span></div>
			<div id="demo-cursor">${cursorSvg}</div>
			<div id="demo-card">${mark(96)}<h1>Wingspan</h1><p>A third-party extension that adds features to Monarch Money</p></div>`;
		document.documentElement.append(style, overlay);

		const card = overlay.querySelector<HTMLElement>('#demo-card');
		if (card && (!hasTitleCard || sessionStorage.getItem('demo-card') === 'hidden')) card.style.display = 'none';
		const cursor = overlay.querySelector<HTMLElement>('#demo-cursor');
		document.addEventListener(
			'mousemove',
			event => {
				if (!cursor) return;
				cursor.style.left = `${event.clientX}px`;
				cursor.style.top = `${event.clientY}px`;
			},
			true
		);
		document.addEventListener(
			'mousedown',
			event => {
				const ripple = document.createElement('div');
				ripple.className = 'demo-ripple';
				ripple.style.left = `${event.clientX}px`;
				ripple.style.top = `${event.clientY}px`;
				overlay.append(ripple);
				ripple.addEventListener('animationend', () => ripple.remove());
			},
			true
		);
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
	else install();
}

/** Drives the overlay from the test: captions, highlights, cursor clicks and the title cards. */
export class DemoOverlay {
	public constructor(private readonly page: Page) {}

	public async hideTitleCard(): Promise<void> {
		await this.page.evaluate(() => {
			sessionStorage.setItem('demo-card', 'hidden');
			const card = document.getElementById('demo-card');
			card?.classList.add('hidden');
			card?.addEventListener('transitionend', () => card.style.setProperty('display', 'none'), { once: true });
		});
	}

	public async showClosingCard(): Promise<void> {
		await this.clear();
		await this.page.evaluate(() => {
			const card = document.getElementById('demo-card');
			if (!card) return;
			card.querySelector('h1')?.replaceChildren('Wingspan for Monarch Money');
			card.querySelector('p')?.replaceChildren('wingspan.axerie.com');
			const note = document.createElement('small');
			note.textContent = 'Not affiliated with Monarch Money';
			card.append(note);
			card.style.display = 'flex';
			card.classList.add('hidden');
			requestAnimationFrame(() => card.classList.remove('hidden'));
		});
	}

	/** Shows a caption naming the Monarch page and what the feature does, and outlines the feature. `isAtTop` moves the caption off something at the bottom, like a toast. */
	public async explain(pageName: string, text: string, feature: Locator, { isAtTop = false } = {}): Promise<void> {
		const box = await feature.boundingBox();
		await this.page.evaluate(
			({ pageName, text, box, padding, isAtTop }) => {
				const caption = document.getElementById('demo-caption');
				const chip = document.getElementById('demo-chip');
				const textEl = document.getElementById('demo-text');
				const highlight = document.getElementById('demo-highlight');
				if (!caption || !chip || !textEl || !highlight) return;
				chip.textContent = pageName;
				caption.classList.toggle('at-top', isAtTop);
				textEl.textContent = text;
				if (box) {
					highlight.style.left = `${box.x - padding}px`;
					highlight.style.top = `${box.y - padding}px`;
					highlight.style.width = `${box.width + 2 * padding}px`;
					highlight.style.height = `${box.height + 2 * padding}px`;
				}
				requestAnimationFrame(() => {
					caption.classList.add('shown');
					if (box) highlight.classList.add('shown');
				});
			},
			{ pageName, text, box, padding: HIGHLIGHT_PADDING, isAtTop }
		);
	}

	/** Scrolls `target` into view, again if Monarch redraws it mid-scroll, as it does while a page's data loads. */
	public async scrollTo(target: Locator): Promise<void> {
		await expect(async () => target.scrollIntoViewIfNeeded({ timeout: SCROLL_ATTEMPT_MS })).toPass();
	}

	/** Hides the caption and highlight as the view changes. */
	public async clear(): Promise<void> {
		await this.page.evaluate(() => {
			document.getElementById('demo-caption')?.classList.remove('shown');
			document.getElementById('demo-highlight')?.classList.remove('shown');
		});
	}

	/** Glides the cursor to the middle of `target` and clicks it, as a person would. */
	public async click(target: Locator): Promise<void> {
		await this.clear();
		await this.scrollTo(target);
		const box = await target.boundingBox();
		if (!box) throw new Error('The demo has nothing to click.');
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await this.page.mouse.move(x, y, { steps: CURSOR_STEPS });
		await this.page.waitForTimeout(CLICK_SETTLE_MS);
		await target.click();
	}

	/** Moves within Monarch's app without reloading, so the video doesn't flash a blank page between features. */
	public async goTo(path: string): Promise<void> {
		await this.clear();
		await this.page.evaluate(nextPath => {
			history.pushState({}, '', nextPath);
			dispatchEvent(new PopStateEvent('popstate'));
		}, path);
	}
}
