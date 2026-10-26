import type { WingspanBuilder } from '../../wingspanBuilder';
import type { ProjectedBalancesService } from '../cashFlow/projectedBalances/services/projectedBalancesService';
import { GoalPlannerFeature } from './goalPlanner/goalPlannerFeature';
import { GoalProjector } from './goalPlanner/services/goalProjector';

/** Adds the Goal planner to Monarch's Save up goals. */
export function addGoals(app: WingspanBuilder, projectedBalances: ProjectedBalancesService): void {
	const { pages, monarchApi, monarchData, dataService, syncedQueries, queryClient, calendar, formatter } = app;
	app.addFeature(
		new GoalPlannerFeature(pages.goals, monarchApi.goals, monarchApi.budget, projectedBalances, monarchData, dataService, syncedQueries, queryClient, new GoalProjector(calendar), calendar, formatter)
	);
}
