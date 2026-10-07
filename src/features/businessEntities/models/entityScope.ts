import type { Account } from '../../../monarch/api/models/account';
import type { BusinessEntity } from '../../../monarch/api/models/businessEntity';

/** Monarch's id for Household in its business filter, meaning anything not owned by a business. */
export const HOUSEHOLD_ENTITY_ID = 'business_entity_none';

/** The entity an account belongs to: its business, or Household when it has no business or there is no account. */
export const entityIdOf = (account: Pick<Account, 'businessEntity'> | undefined): string => account?.businessEntity?.id ?? HOUSEHOLD_ENTITY_ID;

/** Which entities are shown: Household, one or more businesses, or everything. */
export class EntityScope {
	private constructor(
		public readonly entityIds: readonly string[],
		public readonly isEverything: boolean
	) {}

	public static everything(businesses: readonly Pick<BusinessEntity, 'id'>[]): EntityScope {
		return new EntityScope([HOUSEHOLD_ENTITY_ID, ...businesses.map(business => business.id)], true);
	}

	/** Built from Monarch's filter, where selecting nothing or every entity means everything. Businesses that no longer exist are dropped. */
	public static fromFilter(filterSet: readonly string[], businesses: readonly Pick<BusinessEntity, 'id'>[]): EntityScope {
		const everything = EntityScope.everything(businesses);
		const chosenIds = everything.entityIds.filter(entityId => filterSet.includes(entityId));
		return chosenIds.length === 0 || chosenIds.length === everything.entityIds.length ? everything : new EntityScope(chosenIds, false);
	}

	/** Used before businesses load: the filter as-is. */
	public static assumed(filterSet: readonly string[]): EntityScope {
		return filterSet.length ? new EntityScope([...filterSet], false) : EntityScope.everything([]);
	}

	/** Whether that entity is shown. Everything includes every entity, even a business that hasn't loaded yet. */
	public includes(entityId: string): boolean {
		return this.isEverything || this.entityIds.includes(entityId);
	}

	public get soleEntityId(): string | null {
		return this.entityIds.length === 1 ? (this.entityIds[0] ?? null) : null;
	}
}
