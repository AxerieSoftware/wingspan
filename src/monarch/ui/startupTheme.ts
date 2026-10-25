import { WingspanAttribute } from '../pages/wingspanAttributes';
import { readPersistedField } from '../persistedState';
import type { MonarchSession } from '../session/monarchSession';

const ROOT_SLICE_KEY = 'persist:root';
const UI_FIELD = 'persistentUi';
/**
 * Monarch's dark page color and butterfly track (dark `--gray-2` and `--gray-4`) for its two loading screens. The app's
 * loader forces light with layered `!important` utilities, so it gets the variables they read instead.
 */
const DARK_LOADING_STYLES = `
	:root[data-theme="dark"] { background-color: #191918; }
	:root[data-theme="dark"] .loading-butterfly-track { stroke: #2a2a28; }
	:root[data-theme="dark"] [data-external-id="full-page-monarch-loading-animation"] { --background-primary: #191918; --progress-background: #2a2a28; }
`;

/**
 * Monarch's loading screens are always light, and its app only applies a dark theme once its scripts run, so a dark
 * page flashes light on every load. This applies the theme first, worked out as Monarch's app does.
 */
export class StartupTheme {
	public constructor(
		private readonly window: Window,
		private readonly session: MonarchSession
	) {}

	/** Applies a dark theme before Monarch's app does. Signed out, Monarch is always light, so it does nothing. */
	public apply(): void {
		if (!this.session.hasUser() || !this.isDark()) return;
		const rootEl = this.window.document.documentElement;
		rootEl.dataset.theme = 'dark';
		const styleEl = this.window.document.createElement('style');
		styleEl.setAttribute(WingspanAttribute.startupTheme, '');
		styleEl.textContent = DARK_LOADING_STYLES;
		rootEl.append(styleEl);
	}

	/** Like Monarch's app, a missing preference means light, and "system" follows the system's setting. */
	private isDark(): boolean {
		const preference = (readPersistedField(this.window.localStorage, ROOT_SLICE_KEY, UI_FIELD) as { themePreference?: unknown } | undefined)?.themePreference;
		if (preference === 'system') return this.window.matchMedia('(prefers-color-scheme: dark)').matches;
		return preference === 'dark';
	}
}
