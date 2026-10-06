import { describe, expect, it } from 'vitest';
import { Calendar } from '../../common/calendar';
import { Formatter } from './formatter';

const formatter = new Formatter(new Calendar(() => Temporal.PlainDate.from('2026-10-02')));

describe('money', () => {
	it('never shows float noise as -$0.00', () => {
		expect(formatter.money(0.3 - (0.1 + 0.2))).toBe('$0.00');
		expect(formatter.money(-0)).toBe('$0.00');
		expect(formatter.wholeMoney(-0.4)).toBe('$0');
	});

	it('rounds to the cent', () => {
		expect(formatter.money(1234.565)).toBe('$1,234.57');
		expect(formatter.money(-12.5)).toBe('-$12.50');
	});
});
