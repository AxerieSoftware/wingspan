import * as v from 'valibot';

/** Where each goal's money goes once it's done: another goal or debt's id, by the finished goal's id. */
export interface GoalRollovers {
	rollsToByGoalId: Record<string, string>;
}

export const emptyGoalRollovers = (): GoalRollovers => ({ rollsToByGoalId: {} });

export const GoalRolloversSchema: v.GenericSchema<GoalRollovers> = v.looseObject({
	rollsToByGoalId: v.record(v.string(), v.string())
});
