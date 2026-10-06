import { floorToCents, MONTHS_PER_YEAR, PERCENT } from '../../../../common/money';
import { ESTIMATED_MINIMUM } from '../../../recurring/statements/models/cardPaymentPlans';

/** Estimates a card's minimum payment when Monarch doesn't have it, using ESTIMATED_MINIMUM_RULE, rounded down to the dollar. */
export class MinimumPaymentEstimator {
	/** The minimum on a statement balance; $0 when nothing is owed. */
	public estimate(statementBalance: number, apr: number | null): number {
		if (statementBalance <= 0) return 0;
		const share = apr === null ? ESTIMATED_MINIMUM.balanceShareWithoutApr : ESTIMATED_MINIMUM.balanceShare + apr / PERCENT / MONTHS_PER_YEAR;
		// Floor to the cent first to clear float error, so $42.00 can't drop to $41 and $41.997 can't round up to $42.
		return Math.floor(floorToCents(Math.max(ESTIMATED_MINIMUM.floor, statementBalance * share)));
	}
}
