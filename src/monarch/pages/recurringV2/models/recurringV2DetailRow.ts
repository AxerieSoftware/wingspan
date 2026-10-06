/** Wingspan's row in an item's detail panel; render returns its unmount. */
export interface RecurringV2DetailRow {
	render(detailRowEl: HTMLElement): () => void;
}
