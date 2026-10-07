import type { WingspanBuilder } from '../../wingspanBuilder';
import type { Recurring } from '../recurring/createRecurring';
import type { BusinessFilter } from './models/businessFilter';
import { BusinessEntityView } from './services/businessEntityView';
import { EntityMembership } from './services/entityMembership';
import { WorkspaceChoice } from './services/workspaceChoice';
import { WorkspaceNavigation } from './services/workspaceNavigation';
import { WorkspaceFeature } from './workspaceFeature';

/** Added before the other features so they apply the workspace on the same sync. */
export function addBusinessEntities(app: WingspanBuilder, recurring: Recurring): BusinessFilter {
	const { window, pages, monarchData, syncedQueries, syncScheduler, calendar, formatter } = app;
	const view = new BusinessEntityView(new WorkspaceChoice(window.localStorage), app.session, app.monarchApi.accounts, app.queryClient);
	const membership = new EntityMembership(recurring.kinds);
	const navigation = new WorkspaceNavigation(window);
	app.addFeature(
		new WorkspaceFeature(
			pages.sidebar,
			pages.accounts,
			pages.header,
			pages.settings,
			navigation,
			pages.recurring,
			pages.cashFlow,
			{ view, membership },
			monarchData,
			app.monarchApi.recurring,
			syncedQueries,
			syncScheduler,
			calendar,
			formatter
		)
	);
	return { view, membership };
}
