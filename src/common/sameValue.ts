/** Deep equality for plain data: arrays by position, objects by key. A missing key equals one set to undefined. */
export function isSameValue(first: unknown, second: unknown): boolean {
	if (Object.is(first, second)) return true;
	if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null) return false;
	if (Array.isArray(first) !== Array.isArray(second)) return false;
	if (Array.isArray(first) && Array.isArray(second)) return first.length === second.length && first.every((value, index) => isSameValue(value, second[index]));

	const firstRecord = first as Record<string, unknown>;
	const secondRecord = second as Record<string, unknown>;
	const keys = new Set([...Object.keys(firstRecord), ...Object.keys(secondRecord)]);
	return [...keys].every(key => isSameValue(firstRecord[key], secondRecord[key]));
}
