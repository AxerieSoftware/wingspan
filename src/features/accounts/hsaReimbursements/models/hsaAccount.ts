import type { Account } from '../../../../monarch/api/models/account';

/** Monarch's subtype for a health savings account. */
const HSA_SUBTYPE = 'health_savings_account';

export const isHsaAccount = (account: Account): boolean => account.subtype?.name === HSA_SUBTYPE;
