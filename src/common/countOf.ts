/** A count with its noun, as "1 receipt" or "3 receipts". */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}
