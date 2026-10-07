import { describe, expect, it } from 'vitest';
import { emptyWingspanData } from '../../../../data/models/wingspanData';
import type { Account } from '../../../../monarch/api/models/account';
import { EntityScope, HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import { CashSettingsResolver } from './cashSettingsResolver';
import { EntityCashSettings } from './entityCashSettings';

const STUDIO = 'studio';
const business = { businessEntity: { id: STUDIO } };
const account = (id: string, displayName: string, typeName: string, extra: Partial<Account> = {}): Account => ({
	id,
	displayName,
	currentBalance: 0,
	isAsset: typeName !== 'credit',
	isHidden: false,
	type: { name: typeName, display: typeName },
	...extra
});
const accounts = [
	account('joint', 'Joint Checking', 'depository'),
	account('savings', 'Savings', 'depository'),
	account('visa', 'Visa', 'credit'),
	account('studioChecking', 'Contoso Checking', 'depository', business),
	account('studioSavings', 'Studio Savings', 'depository', business),
	account('studioCard', 'Studio Card', 'credit', business)
];
const settings = new EntityCashSettings(new CashSettingsResolver());

describe('cash and cards for each part of the household', () => {
	it("never counts another part's account, even one chosen before it moved to a business", () => {
		const data = {
			...emptyWingspanData(),
			cashSettings: {
				cushion: 0,
				checkingAccountIds: ['joint', 'studioChecking'],
				cardAccountIds: ['visa', 'studioCard'],
				knownCardAccountIds: ['visa'],
				reserveAccountIds: ['savings', 'studioSavings']
			}
		};

		expect(settings.forEntity(accounts, data, HOUSEHOLD_ENTITY_ID)).toMatchObject({ checkingAccountIds: ['joint'], cardAccountIds: ['visa'], reserveAccountIds: ['savings'] });
		// With everything shown, it isn't drawn on twice either: once as the business's own and once as the household's choice.
		expect(settings.forScope(accounts, data, EntityScope.fromFilter([], [{ id: STUDIO }])).reserveAccountIds).toEqual(['savings', 'studioSavings']);
	});
});
