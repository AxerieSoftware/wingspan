/** Free cash split into what Monarch's budget plans for goals within the window, and what's truly free. */
export interface FreeCashSplit {
	promised: number;
	/** Negative when goal contributions are more than free cash. */
	trulyFree: number;
	goals: { name: string; amount: number }[];
}
