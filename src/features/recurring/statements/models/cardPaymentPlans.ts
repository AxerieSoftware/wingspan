import type { ReadonlySignal } from '@preact/signals-core';
import { CENT_TOLERANCE } from '../../../../common/money';

/** A card's payment for one due date: the statement balance, the minimum payment, and how much checking can pay while keeping its reserve. */
export interface PlannedCardPayment {
	date: string;
	amount: number;
	owed: number;
	minimum: number | null;
	/** Estimated by Wingspan because the card's account in Monarch has no minimum payment. */
	minimumIsEstimated: boolean;
}

/** Keyed by card payment item id, sorted by due date. */
export interface CardPaymentPlans {
	readonly byItemId: ReadonlySignal<ReadonlyMap<string, PlannedCardPayment[]>>;
}

/** Within a cent of the statement balance counts as paid in full. */
export const paysInFull = (payment: PlannedCardPayment): boolean => payment.amount >= payment.owed - CENT_TOLERANCE;

/** Short of the minimum by more than a cent. False when there's no minimum. */
export const missesMinimum = (payment: PlannedCardPayment): boolean => payment.minimum !== null && payment.amount < payment.minimum - CENT_TOLERANCE;

/** How the minimum is estimated when the card's Monarch account doesn't have one, based on how most issuers calculate it. */
export const ESTIMATED_MINIMUM = { floor: 35, balanceShare: 0.01, balanceShareWithoutApr: 0.02 } as const;

/** User-facing description of how the estimated minimum is calculated. */
export const ESTIMATED_MINIMUM_RULE = `${ESTIMATED_MINIMUM.balanceShare * 100}% of the statement balance plus a month's interest, at least $${ESTIMATED_MINIMUM.floor} (${ESTIMATED_MINIMUM.balanceShareWithoutApr * 100}% of the balance without an APR)`;
