import type { WingspanBuilder } from '../../wingspanBuilder';
import type { Recurring } from '../recurring/createRecurring';
import { BusinessEntitySwitchFeature } from './businessEntitySwitchFeature';
import type { BusinessFilter } from './models/businessFilter';
import { BusinessEntityView } from './services/businessEntityView';
import { EntityMembership } from './services/entityMembership';

/** Added before the other features so they apply the selected business filter on the same sync. */
export function addBusinessEntities(app: WingspanBuilder, recurring: Recurring): BusinessFilter {
	const { window, pages, monarchData, syncedQueries, syncScheduler, calendar, formatter } = app;
	const view = new BusinessEntityView(window.sessionStorage, app.monarchApi.accounts, app.queryClient);
	const membership = new EntityMembership(recurring.kinds);
	app.addFeature(new BusinessEntitySwitchFeature(pages.recurring, pages.cashFlow, { view, membership }, monarchData, app.monarchApi.recurring, syncedQueries, syncScheduler, calendar, formatter));
	return { view, membership };
}
