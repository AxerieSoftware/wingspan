import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import type { Account } from '../../../../monarch/api/models/account';
import { HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import type { DefaultPayingAccount } from '../../../recurring/recurringItems/models/defaultPayingAccount';
import type { EntityCashSettings } from './entityCashSettings';

/** A bill with no account of its own belongs to the household, so it's paid from the household's first checking account. */
export class CheckingPayingAccount implements DefaultPayingAccount {
	public constructor(
		private readonly dataService: WingspanDataService,
		private readonly entityCashSettings: EntityCashSettings
	) {}

	/** The household's first checking account, or undefined when it has none. */
	public accountId(accounts: Account[]): string | undefined {
		return this.entityCashSettings.forEntity(accounts, this.dataService.data.value, HOUSEHOLD_ENTITY_ID).checkingAccountIds[0];
	}
}
