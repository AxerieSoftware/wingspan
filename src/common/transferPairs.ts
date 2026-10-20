import type { Transaction } from '../monarch/api/models/transaction';
import type { Calendar } from './calendar';
import { toCents } from './money';

/** How two sides of a move between the household's own accounts are found. */
export interface TransferPairOptions {
	/** How far apart in days the two sides can post. */
	maxDays: number;
	/** A candidate this prefers wins over a closer one, as a transfer over a bill for the same amount. */
	isPreferred?(candidate: Transaction): boolean;
}

/**
 * The other side of each transaction in `sides`, in the order given: a candidate for the same amount the other way, on
 * another account, within a few days, the closest winning. A transaction is paired at most once, on either side.
 */
export function transferOtherSides(sides: readonly Transaction[], candidates: readonly Transaction[], calendar: Calendar, { maxDays, isPreferred }: TransferPairOptions): Map<string, Transaction> {
	const centsOf = (transaction: Transaction) => toCents(transaction.amount);
	const preference = (candidate: Transaction) => Number(isPreferred?.(candidate) ?? false);
	const candidatesByCents = Map.groupBy(candidates, centsOf);
	const pairedIds = new Set<string>();
	const otherSideById = new Map<string, Transaction>();
	for (const side of sides) {
		if (pairedIds.has(side.id)) continue;
		const nearby = (candidatesByCents.get(-centsOf(side)) ?? [])
			.filter(candidate => !pairedIds.has(candidate.id) && candidate.accountId !== side.accountId)
			.map(candidate => ({ candidate, days: Math.abs(calendar.daysBetween(side.date, candidate.date)) }))
			.filter(({ days }) => days <= maxDays);
		const [closest] = nearby.toSorted((a, b) => preference(b.candidate) - preference(a.candidate) || a.days - b.days || a.candidate.id.localeCompare(b.candidate.id));
		if (!closest) continue;
		pairedIds.add(side.id);
		pairedIds.add(closest.candidate.id);
		otherSideById.set(side.id, closest.candidate);
	}
	return otherSideById;
}
