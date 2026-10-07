import type { Account } from '../../../../monarch/api/models/account';
import { MonarchAccountType } from '../../../../monarch/api/models/monarchValues';
import { aprOf } from '../../projectedBalances/models/cardTerms';
import type { CashSettings } from '../models/cashSettings';
import { DEFAULT_SAFETY_DAYS, type SavedCashSettings } from '../models/savedCashSettings';

const CHECKING_NAME_PATTERN = /checking/i;

/** Resolves the settings for one part of the household (the household itself or a business) using only that part's accounts. */
export class CashSettingsResolver {
	/** Checks saved choices against the current accounts and fills in defaults for anything unset. */
	public cashSettings(accounts: Account[], saved: SavedCashSettings): CashSettings {
		const checkingAccountIds = this.checkingAccountIds(accounts, saved.checkingAccountIds);
		return {
			checkingAccountIds,
			cardAccountIds: this.cardAccountIds(accounts, saved.cardAccountIds, saved.knownCardAccountIds),
			reserveAccountIds: this.reserveAccountIds(accounts, checkingAccountIds, saved.reserveAccountIds),
			cushion: saved.cushion,
			safetyDays: saved.safetyDays ?? DEFAULT_SAFETY_DAYS
		};
	}

	/** Monarch's visible cash accounts: the ones that can be checking or a reserve. */
	public cashAccounts(accounts: Account[]): Account[] {
		return accounts.filter(account => account.isAsset && !account.isHidden && account.type.name === MonarchAccountType.cash);
	}

	/**
	 * Defaults to cash accounts named like checking. A chosen account that has since been closed or hidden in Monarch is
	 * dropped so it isn't counted as $0. If none are left, the household is asked to choose again.
	 */
	private checkingAccountIds(accounts: Account[], chosenAccountIds: string[] | undefined): string[] {
		if (chosenAccountIds) {
			const cashAccountIds = new Set(this.cashAccounts(accounts).map(account => account.id));
			return chosenAccountIds.filter(accountId => cashAccountIds.has(accountId));
		}
		return this.cashAccounts(accounts)
			.filter(account => CHECKING_NAME_PATTERN.test(account.displayName))
			.map(account => account.id);
	}

	/** Monarch's visible cards. */
	public cardAccounts(accounts: Account[]): Account[] {
		return accounts.filter(account => account.type.name === MonarchAccountType.credit && !account.isHidden);
	}

	/**
	 * Defaults to every card, lowest APR first and cards without an APR last. A card added after the household chose is
	 * also counted, at the end.
	 */
	private cardAccountIds(accounts: Account[], chosenAccountIds: string[] | undefined, knownAccountIds: string[] | undefined): string[] {
		const sortableApr = (account: Account) => aprOf(account) ?? Number.POSITIVE_INFINITY;
		const cardsByApr = this.cardAccounts(accounts).toSorted((a, b) => sortableApr(a) - sortableApr(b));
		if (!chosenAccountIds) return cardsByApr.map(account => account.id);

		const newCardIds = knownAccountIds ? cardsByApr.filter(account => !knownAccountIds.includes(account.id)).map(account => account.id) : [];
		// A chosen card that has since been closed or hidden in Monarch isn't counted or borrowed on.
		const cardIds = new Set(cardsByApr.map(account => account.id));
		return [...chosenAccountIds.filter(accountId => cardIds.has(accountId)), ...newCardIds];
	}

	/** Defaults to the other cash accounts. A chosen one that has since been closed, hidden or moved to another part isn't drawn on. */
	private reserveAccountIds(accounts: Account[], checkingAccountIds: string[], chosenAccountIds: string[] | undefined): string[] {
		const reserveIds = this.cashAccounts(accounts)
			.map(account => account.id)
			.filter(accountId => !checkingAccountIds.includes(accountId));
		return chosenAccountIds ? chosenAccountIds.filter(accountId => reserveIds.includes(accountId)) : reserveIds;
	}
}
