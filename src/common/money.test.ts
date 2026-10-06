import { describe, expect, it } from 'vitest';
import { floorToCents, roundToCents } from './money';

describe('rounding to the cent', () => {
	it('rounds half a cent up, even where floating-point error leaves it just under', () => {
		expect(roundToCents(1.005)).toBe(1.01);
		expect(roundToCents(0.285)).toBe(0.29);
		expect(roundToCents(2.675)).toBe(2.68);
		expect(roundToCents(1234567.895)).toBe(1234567.9);
	});

	it('rounds a negative amount the same way, away from zero', () => {
		expect(roundToCents(-1.005)).toBe(-1.01);
		expect(roundToCents(-0.125)).toBe(-0.13);
	});

	it('leaves amounts under half a cent alone', () => {
		expect(roundToCents(1.234)).toBe(1.23);
		expect(roundToCents(-1.234)).toBe(-1.23);
		expect(roundToCents(0.1 + 0.2)).toBe(0.3);
	});

	it('never gives -0 for a negative amount that rounds to nothing', () => {
		expect(Object.is(roundToCents(-0.001), 0)).toBe(true);
	});

	it('floors without losing a cent to floating-point error', () => {
		expect(floorToCents(0.29)).toBe(0.29);
		expect(floorToCents(1.239)).toBe(1.23);
	});
});
