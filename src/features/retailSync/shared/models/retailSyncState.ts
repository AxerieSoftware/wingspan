/** What the retail sync menu next to Monarch's Settings shows. The final result shows in a dialog instead. */
export type RetailSyncState = { phase: 'idle' } | { phase: 'waiting' } | { phase: 'reading'; found: number; fetched: number; sent: number };
