import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

const SAFARI_EXTENSION = path.resolve('.output/safari-mv3');
/** Where the stand-in keeps extension storage: the page's own localStorage, so it lasts across reloads like the real thing. */
const STORAGE_KEY = '__wingspanE2eExtensionStorage';
const EXTENSION_ID = 'wingspan-e2e';

/**
 * Playwright can't load extensions into WebKit, so Wingspan's Safari build is injected into Monarch's pages instead, with
 * a stand-in for the extension APIs its content scripts use. Unlike a real extension, the scripts share the page's world.
 */
export async function injectWingspan(context: BrowserContext): Promise<void> {
	const manifest = JSON.parse(fs.readFileSync(path.join(SAFARI_EXTENSION, 'manifest.json'), 'utf8'));
	const contentScript = (name: string) => fs.readFileSync(path.join(SAFARI_EXTENSION, 'content-scripts', name), 'utf8');
	await context.addInitScript({
		content: `(() => {
	if (location.host !== 'app.monarch.com' || window !== window.top) return;
	(${installExtensionStandIn.toString()})(${JSON.stringify(manifest)}, ${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(EXTENSION_ID)});
	${contentScript('monarch-early.js')}
	document.addEventListener('DOMContentLoaded', () => {
		${contentScript('monarch.js')}
	}, { once: true });
})();`
	});
}

/** Runs in the page: the parts of `browser.runtime` and `browser.storage` Wingspan's content scripts use. */
function installExtensionStandIn(manifest: object, storageKey: string, extensionId: string) {
	type Listener = (...args: unknown[]) => void;
	const createEvent = () => {
		const listeners = new Set<Listener>();
		return {
			listeners,
			addListener: (listener: Listener) => listeners.add(listener),
			removeListener: (listener: Listener) => listeners.delete(listener),
			hasListener: (listener: Listener) => listeners.has(listener)
		};
	};
	const read = (): Record<string, unknown> => JSON.parse(localStorage.getItem(storageKey) ?? '{}');
	const onChanged = createEvent();
	const write = (items: Record<string, unknown>, changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
		localStorage.setItem(storageKey, JSON.stringify(items));
		for (const listener of onChanged.listeners) listener(changes, 'local');
	};
	const keysOf = (keys: unknown): string[] | null => {
		if (keys === null || keys === undefined) return null;
		if (typeof keys === 'string') return [keys];
		return Array.isArray(keys) ? keys : Object.keys(keys as object);
	};

	const local = {
		get: async (keys?: unknown) => {
			const items = read();
			const wanted = keysOf(keys);
			return wanted ? Object.fromEntries(wanted.filter(key => key in items).map(key => [key, items[key]])) : items;
		},
		set: async (values: Record<string, unknown>) => {
			const items = read();
			const changes = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { oldValue: items[key], newValue: value }]));
			write({ ...items, ...JSON.parse(JSON.stringify(values)) }, changes);
		},
		remove: async (keys: string | string[]) => {
			const items = read();
			const removed = (typeof keys === 'string' ? [keys] : keys).filter(key => key in items);
			write(Object.fromEntries(Object.entries(items).filter(([key]) => !removed.includes(key))), Object.fromEntries(removed.map(key => [key, { oldValue: items[key] }])));
		},
		clear: async () => {
			const items = read();
			write({}, Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { oldValue: value }])));
		},
		onChanged
	};

	Object.defineProperty(globalThis, 'browser', {
		configurable: true,
		value: {
			runtime: { id: extensionId, getManifest: () => manifest, getURL: (resourcePath: string) => resourcePath, sendMessage: async () => undefined, onMessage: createEvent() },
			storage: { local, onChanged }
		}
	});
}
