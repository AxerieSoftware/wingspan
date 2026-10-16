/** Wingspan's row in an item's detail panel; render returns its unmount. */
export interface RecurringV2DetailRow {
	render(detailRowEl: HTMLElement): () => void;
}

/** Wingspan's rows in an item's detail panel, in the order they're shown. */
export const DETAIL_ROW_ORDER = ['dueDay', 'paysToward'] as const;

export type RecurringV2DetailRowKey = (typeof DETAIL_ROW_ORDER)[number];
