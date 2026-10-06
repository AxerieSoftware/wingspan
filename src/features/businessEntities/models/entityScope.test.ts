import { describe, expect, it } from 'vitest';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from './entityScope';

describe('which entities a scope includes', () => {
	it('includes every business when showing everything, even before businesses load', () => {
		expect(EntityScope.everything([]).includes('business_1')).toBe(true);
		expect(EntityScope.assumed([]).includes('business_1')).toBe(true);
	});

	it('includes only the selected entities when the filter selects some', () => {
		const scope = EntityScope.fromFilter(['business_1'], [{ id: 'business_1' }, { id: 'business_2' }]);
		expect(scope.includes('business_1')).toBe(true);
		expect(scope.includes('business_2')).toBe(false);
		expect(scope.includes(HOUSEHOLD_ENTITY_ID)).toBe(false);
	});
});
