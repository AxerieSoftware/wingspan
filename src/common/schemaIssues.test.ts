import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { describeIssues } from './schemaIssues';

describe("describing data that didn't fit", () => {
	it('reports the path and expected type, never the values received, once per list', () => {
		const result = v.safeParse(v.array(v.object({ amount: v.number(), name: v.string() })), [
			{ amount: '-42.17', name: 'Corner Pharmacy' },
			{ amount: '-9.99', name: 'Corner Pharmacy' }
		]);

		const description = result.success ? '' : describeIssues(result.issues);

		expect(description).toBe('*.amount: expected number');
		expect(description).not.toMatch(/42|Pharmacy/);
	});
});
