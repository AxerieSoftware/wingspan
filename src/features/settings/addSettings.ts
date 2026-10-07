import type { WingspanBuilder } from '../../wingspanBuilder';
import type { BusinessFilter } from '../businessEntities/models/businessFilter';
import type { HiddenSidebarItems } from '../sidebar/hiddenItems/services/hiddenSidebarItems';
import { ProblemReport } from './wingspanSettings/services/problemReport';
import { StorageNoticesFeature } from './wingspanSettings/storageNoticesFeature';
import { WingspanSettingsFeature } from './wingspanSettings/wingspanSettingsFeature';

/** Adds Wingspan's settings card and page to Monarch's Settings, plus the toasts about where its data is saved. */
export function addSettings(app: WingspanBuilder, businessFilter: BusinessFilter, hiddenSidebarItems: HiddenSidebarItems): void {
	const { window, dataService, toastService, pages, version } = app;
	app.addFeature(new StorageNoticesFeature(window, dataService, toastService, pages.settings));
	app.addFeature(new WingspanSettingsFeature(pages.settings, dataService, businessFilter.view, hiddenSidebarItems, new ProblemReport(version, window.navigator.userAgent), version));
}
