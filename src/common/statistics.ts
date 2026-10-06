/** The middle value, or the mean of the two middle ones. 0 for none. */
export function median(values: number[]): number {
	if (!values.length) return 0;
	const sortedValues = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sortedValues.length / 2);
	return sortedValues.length % 2 ? (sortedValues[middle] as number) : ((sortedValues[middle - 1] as number) + (sortedValues[middle] as number)) / 2;
}

/** The middle value, or the lower of the two middle ones, so it's always one of the values given. Throws for none. */
export function lowerMedian(values: number[]): number {
	const sortedValues = [...values].sort((a, b) => a - b);
	const middleValue = sortedValues[Math.floor((sortedValues.length - 1) / 2)];
	if (middleValue === undefined) throw new RangeError('lowerMedian needs at least one value.');
	return middleValue;
}
