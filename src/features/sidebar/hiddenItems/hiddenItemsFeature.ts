import { effect } from '@preact/signals-core';
import type { SidebarPage } from '../../../monarch/pages/sidebar/sidebarPage';
import type { WingspanFeature } from '../../wingspanFeature';
import type { HiddenSidebarItems } from './services/hiddenSidebarItems';

/** The early content script hides the items as the page loads; this keeps up with changes made in settings. */
export class HiddenItemsFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();

	public constructor(
		private readonly sidebar: SidebarPage,
		private readonly hiddenItems: HiddenSidebarItems
	) {}

	public start(): void {
		this.subscriptions.defer(effect(() => this.sidebar.hideItems(this.hiddenItems.hidden.value)));
	}

	public sync(): void {
		// Monarch adds some items only once its feature flags load, so the list settings shows is refreshed every sync.
		this.hiddenItems.follow(this.sidebar.items);
	}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
		this.sidebar.hideItems([]);
	}
}
