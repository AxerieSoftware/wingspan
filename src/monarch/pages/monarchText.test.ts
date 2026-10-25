import { describe, expect, it } from 'vitest';
import { parseMoney, parseMonthYear, parseShortDate } from './monarchText';

describe("reading Monarch's displayed text", () => {
	it('reads amounts with or without cents, signs and commas, and nothing else', () => {
		expect(parseMoney('$1,250.00')).toBe(1250);
		expect(parseMoney('-$50')).toBe(-50);
		expect(parseMoney('95%')).toBeNull();
	});

	it('reads dates and month headings as ISO', () => {
		expect(parseShortDate('May 1, 2024')).toBe('2024-05-01');
		expect(parseMonthYear('October 2026')).toBe('2026-10');
		expect(parseMonthYear('Oct 2026')).toBe('2026-10');
		expect(parseMonthYear('Today')).toBeNull();
	});
});
