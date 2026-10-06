import type { Account } from '../../../../monarch/api/models/account';

/** The account an item is paid from when its match rule doesn't name one. */
export interface DefaultPayingAccount {
	accountId(accounts: Account[]): string | undefined;
}
