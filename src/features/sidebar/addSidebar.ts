import type { WingspanBuilder } from '../../wingspanBuilder';
import { HiddenItemsFeature } from './hiddenItems/hiddenItemsFeature';
import { HiddenSidebarItems } from './hiddenItems/services/hiddenSidebarItems';

/** Returns the hidden items, for Wingspan's settings page to edit. */
export function addSidebar(app: WingspanBuilder): HiddenSidebarItems {
	const hiddenItems = new HiddenSidebarItems(app.window.localStorage);
	app.addFeature(new HiddenItemsFeature(app.pages.sidebar, hiddenItems));
	return hiddenItems;
}
