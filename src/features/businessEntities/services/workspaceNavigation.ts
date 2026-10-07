import { type RouterLocation, withoutBusinessFilter, workspaceRedirect } from '../models/workspaceRoutes';

/** Set before a reload that applies the workspace, so a page that still won't take it doesn't reload forever. */
const RELOAD_MARK_KEY = 'wingspanWorkspaceReload';

/**
 * Opens Monarch's pages filtered to the workspace, setting the filter before the page mounts on a full load or link
 * click. Anything that still arrives unfiltered is fixed afterwards, reloading pages that read the filter only as they mount.
 */
export class WorkspaceNavigation implements Disposable {
	private entityId: string | null = null;
	private lastPath: string | null = null;
	private isListening = false;

	public constructor(private readonly window: Window) {}

	/** Run by the early content script, before Monarch's app reads the URL. */
	public static applyBeforeMonarchStarts(window: Window, entityId: string): void {
		const redirect = workspaceRedirect(currentLocation(window), entityId);
		if (redirect) window.history.replaceState(redirect.state, '', redirect.url);
	}

	/** Null stops filtering, as when there are no businesses to switch between. */
	public follow(entityId: string | null): void {
		this.entityId = entityId;
		if (!entityId) {
			this.stopListening();
			return;
		}
		if (!this.isListening) {
			this.window.addEventListener('click', this.interceptLink, true);
			this.isListening = true;
		}

		// Only on arriving at a page: after that, Monarch's own filter on the page is the household's to change.
		const path = this.window.location.pathname;
		if (path === this.lastPath) return;
		this.lastPath = path;
		const redirect = workspaceRedirect(currentLocation(this.window), entityId);
		if (!redirect) {
			this.window.sessionStorage.removeItem(RELOAD_MARK_KEY);
			return;
		}
		if (redirect.isLive) {
			this.go(redirect, 'replace');
			return;
		}

		const reloadMark = `${path}|${entityId}`;
		if (this.window.sessionStorage.getItem(RELOAD_MARK_KEY) === reloadMark) return;
		this.window.sessionStorage.setItem(RELOAD_MARK_KEY, reloadMark);
		this.window.history.replaceState(redirect.state, '', redirect.url);
		this.window.location.reload();
	}

	/** Reloads the page so it opens filtered to the newly chosen workspace. */
	public reloadInto(): void {
		const location = withoutBusinessFilter(currentLocation(this.window));
		this.window.history.replaceState(location.state, '', location.url);
		this.window.location.reload();
	}

	public [Symbol.dispose](): void {
		this.stopListening();
	}

	/** Takes over a plain click on a link to a page with a business filter, and opens it with the filter already set. */
	private readonly interceptLink = (event: MouseEvent): void => {
		if (!this.entityId || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const linkEl = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
		if (!linkEl || (linkEl.target && linkEl.target !== '_self')) return;
		const url = new URL(linkEl.href, this.window.location.href);
		if (url.origin !== this.window.location.origin) return;

		const redirect = workspaceRedirect({ url, state: null }, this.entityId);
		if (!redirect) return;
		event.preventDefault();
		event.stopPropagation();
		this.lastPath = url.pathname;
		this.go(redirect, 'push');
	};

	/** Fires popstate so Monarch's router follows without a reload. */
	private go(location: RouterLocation, historyMode: 'push' | 'replace'): void {
		if (historyMode === 'push') this.window.history.pushState(location.state, '', location.url);
		else this.window.history.replaceState(location.state, '', location.url);
		this.window.dispatchEvent(new PopStateEvent('popstate', { state: location.state }));
	}

	private stopListening(): void {
		if (!this.isListening) return;
		this.window.removeEventListener('click', this.interceptLink, true);
		this.isListening = false;
	}
}

function currentLocation(window: Window): RouterLocation {
	return { url: new URL(window.location.href), state: window.history.state };
}
