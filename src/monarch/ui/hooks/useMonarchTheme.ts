import { useSyncExternalStore } from 'react';

/** Monarch's color theme, from the `data-theme` attribute on its page. */
export type MonarchTheme = 'light' | 'dark';

/** The theme Monarch is showing, updated when the user switches it. */
export function useMonarchTheme(): MonarchTheme {
	return useSyncExternalStore(subscribe, currentTheme);
}

function subscribe(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	return () => observer.disconnect();
}

function currentTheme(): MonarchTheme {
	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
