import type { WingspanData } from '../../../../data/models/wingspanData';
import type { Account } from '../../../../monarch/api/models/account';
import { type EntityScope, entityIdOf, HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import type { CashSettings } from '../models/cashSettings';
import { DEFAULT_SAFETY_DAYS, emptySavedCashSettings, type SavedCashSettings } from '../models/savedCashSettings';
import type { CashSettingsResolver } from './cashSettingsResolver';

/**
 * Keeps the household's and each business's cash and cards separate: each part's settings, including defaults, use
 * only its own accounts, so one part never counts another's checking or cards.
 */
export class EntityCashSettings {
	public constructor(private readonly resolver: CashSettingsResolver) {}

	/** The part's saved settings; a business that hasn't saved any gets empty settings. */
	public saved(data: WingspanData, entityId: string): SavedCashSettings {
		return entityId === HOUSEHOLD_ENTITY_ID ? data.cashSettings : (data.businessCashSettings[entityId] ?? emptySavedCashSettings());
	}

	/** Merges the changes into the part's existing settings, so fields from a newer Wingspan aren't lost. */
	public withSaved(data: WingspanData, entityId: string, changes: SavedCashSettings): WingspanData {
		const settings = { ...this.saved(data, entityId), ...changes };
		return entityId === HOUSEHOLD_ENTITY_ID ? { ...data, cashSettings: settings } : { ...data, businessCashSettings: { ...data.businessCashSettings, [entityId]: settings } };
	}

	/** The part's accounts: for the household, those no business owns. */
	public accountsOf(accounts: readonly Account[], entityId: string): Account[] {
		return accounts.filter(account => entityIdOf(account) === entityId);
	}

	public forEntity(accounts: readonly Account[], data: WingspanData, entityId: string): CashSettings {
		return this.resolver.cashSettings(this.accountsOf(accounts, entityId), this.saved(data, entityId));
	}

	/**
	 * Combines every part being shown: checking accounts are pooled, the household's cards and reserves are used before
	 * a business's, cushions are added up, and safety days use the longest any part asks for.
	 */
	public forScope(accounts: readonly Account[], data: WingspanData, scope: EntityScope): CashSettings {
		const entityIds = scope.isEverything ? [...new Set([HOUSEHOLD_ENTITY_ID, ...accounts.map(account => entityIdOf(account))])] : scope.entityIds;
		const parts = entityIds.map(entityId => this.forEntity(accounts, data, entityId));
		return {
			checkingAccountIds: parts.flatMap(part => part.checkingAccountIds),
			cardAccountIds: parts.flatMap(part => part.cardAccountIds),
			reserveAccountIds: parts.flatMap(part => part.reserveAccountIds),
			cushion: parts.reduce((total, part) => total + part.cushion, 0),
			safetyDays: Math.max(DEFAULT_SAFETY_DAYS, ...parts.map(part => part.safetyDays))
		};
	}
}
