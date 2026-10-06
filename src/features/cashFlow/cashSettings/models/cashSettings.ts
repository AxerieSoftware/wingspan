/** The saved settings with defaults filled in for anything unset. Cards are in borrowing order, reserves in draw order. */
export interface CashSettings {
	checkingAccountIds: string[];
	cardAccountIds: string[];
	reserveAccountIds: string[];
	cushion: number;
	safetyDays: number;
}
