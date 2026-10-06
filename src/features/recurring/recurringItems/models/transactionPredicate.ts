import type { Transaction } from '../../../../monarch/api/models/transaction';

/** Whether a transaction is one of an item's payments. */
export type TransactionPredicate = (transaction: Transaction) => boolean;
