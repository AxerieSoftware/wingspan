import { describe, expect, it } from 'vitest';
import type { MonarchSession } from '../../monarch/session/monarchSession';
import { StorageScope } from './storageScope';

const sessionOf = (householdIds: (string | null)[]) => {
	let index = 0;
	return { householdId: () => householdIds[Math.min(index++, householdIds.length - 1)] ?? null, hasUser: () => false } as unknown as MonarchSession;
};

describe('storage per household', () => {
	it('keys saved data by the signed-in household', () => {
		expect(new StorageScope(sessionOf(['h1'])).key('wingspan')).toBe('local:wingspan:h1');
	});

	it('refuses to read or save after a different household signs in on the page', () => {
		const scope = new StorageScope(sessionOf(['h1', 'h2']));
		scope.key('wingspan');

		expect(() => scope.key('wingspan')).toThrow(/different Monarch household/);
		expect(() => scope.checkSameHousehold()).toThrow(/different Monarch household/);
	});

	it('reads and saves nothing while signed out', () => {
		expect(() => new StorageScope(sessionOf([null])).key('wingspan')).toThrow(/signed you out/);
	});
});

describe('requests to Monarch', () => {
	it("stop once this page's household is signed out", () => {
		const scope = new StorageScope(sessionOf(['h1', null]));
		scope.key('wingspan');

		expect(() => scope.checkSameHousehold()).toThrow(/signed you out/);
	});
});

describe("a household that can't be read", () => {
	it('reports that, instead of saying Monarch signed the household out', () => {
		const session = { householdId: () => null, hasUser: () => true } as unknown as MonarchSession;

		expect(() => new StorageScope(session).key('wingspan')).toThrow(/can't tell which Monarch household is signed in/);
	});
});
