/** The saved settings with defaults filled in for anything unset. Reserves are in draw order. */
export interface CashSettings {
	checkingAccountIds: string[];
	/** Every visible card, which the projection always counts. */
	cardAccountIds: string[];
	/** The cards checking can borrow on when it runs low, in borrowing order. */
	borrowCardAccountIds: string[];
	reserveAccountIds: string[];
	cushion: number;
	safetyDays: number;
}
