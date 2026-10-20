import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import { HiddenItemsFeature } from './hiddenItems/hiddenItemsFeature';
import { HiddenSidebarItems } from './hiddenItems/services/hiddenSidebarItems';
import { NeedsReviewBadgeFeature } from './needsReview/needsReviewBadgeFeature';

/** Hides the items the household chose and counts transactions to review. Returns the hidden items, for Wingspan's settings page to edit. */
export function addSidebar(app: WingspanBuilder, businessFilter: BusinessFilter): HiddenSidebarItems {
	const { window, pages, monarchApi, syncedQueries, syncScheduler } = app;
	const hiddenItems = new HiddenSidebarItems(window.localStorage);
	app.addFeature(new HiddenItemsFeature(pages.sidebar, hiddenItems));
	app.addFeature(new NeedsReviewBadgeFeature(pages.sidebar, monarchApi.transactions, syncedQueries, businessFilter.view, syncScheduler));
	return hiddenItems;
}
