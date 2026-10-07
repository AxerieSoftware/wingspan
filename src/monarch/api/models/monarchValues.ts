/** Monarch's names for the account types Wingspan acts on. */
export const MonarchAccountType = { cash: 'depository', credit: 'credit' } as const;

/** Transfer's category group type, by its full name or Monarch's one-letter code. */
export const TRANSFER_GROUP_TYPES: ReadonlySet<string> = new Set(['transfer', 'T']);
/** Income's category group type, by its full name or Monarch's one-letter code. */
export const INCOME_GROUP_TYPES: ReadonlySet<string> = new Set(['income', 'I']);

export const MonarchRecurringType = { expense: 'expense', income: 'income', creditCard: 'credit_card' } as const;

/** The occurrence statuses Wingspan acts on. */
export const MonarchOccurrenceStatus = { paid: 'paid', overdue: 'overdue' } as const;
/** Statuses for occurrences Monarch doesn't expect to happen again. */
export const ENDED_OCCURRENCE_STATUSES: ReadonlySet<string> = new Set(['ended', 'possibly_inactive']);
