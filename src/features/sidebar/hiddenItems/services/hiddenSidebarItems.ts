import { type ReadonlySignal, type Signal, signal } from '@preact/signals-core';
import type { SidebarItem } from '../../../../monarch/pages/sidebar/sidebarPage';

/** In Monarch's local storage, not the extension's, so the early script can hide items before Monarch's app starts. */
const STORAGE_KEY = 'wingspanHiddenSidebarItems';

/** Unlike the workspace, it's one choice for every household that signs in to the browser. */
export class HiddenSidebarItems {
	private readonly hiddenIds: Signal<readonly string[]>;
	private readonly sidebarItems = signal<readonly SidebarItem[]>([]);

	public constructor(private readonly storage: Storage) {
		this.hiddenIds = signal(HiddenSidebarItems.read(storage));
	}

	/** Static so the early content script can read it before anything else of Wingspan's starts. */
	public static read(storage: Storage): string[] {
		try {
			const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
			return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
		} catch {
			return [];
		}
	}

	/** Ids of the items hidden from the sidebar. */
	public get hidden(): ReadonlySignal<readonly string[]> {
		return this.hiddenIds;
	}

	/** Every item in Monarch's sidebar, as of the last sync. */
	public get items(): ReadonlySignal<readonly SidebarItem[]> {
		return this.sidebarItems;
	}

	/** Updates `items` from the sidebar. */
	public follow(items: readonly SidebarItem[]): void {
		if (JSON.stringify(items) !== JSON.stringify(this.sidebarItems.peek())) this.sidebarItems.value = items;
	}

	/** Hides or shows an item and saves the choice. */
	public setHidden(itemId: string, isHidden: boolean): void {
		const others = this.hiddenIds.peek().filter(id => id !== itemId);
		this.hiddenIds.value = isHidden ? [...others, itemId] : others;
		try {
			this.storage.setItem(STORAGE_KEY, JSON.stringify(this.hiddenIds.peek()));
		} catch {
			// Monarch keeps its sign-in in the same storage, so it's only unavailable when Monarch can't work either.
		}
	}
}
