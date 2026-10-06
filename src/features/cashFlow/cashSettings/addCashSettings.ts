import type { WingspanBuilder } from '../../../wingspanBuilder';
import type { BusinessFilter } from '../../businessEntities/models/businessFilter';
import { CashSettingsLauncher } from './services/cashSettingsLauncher';
import { CashSettingsResolver } from './services/cashSettingsResolver';
import { EntityCashSettings } from './services/entityCashSettings';

/** Which accounts are checking, cards and reserves, how much to keep in checking, and the dialog to change them. */
export interface CashSettings {
	resolver: CashSettingsResolver;
	entityCashSettings: EntityCashSettings;
	launcher: CashSettingsLauncher;
}

/** Creates the cash settings services, with one dialog launcher shared by every feature that opens it. */
export function addCashSettings(app: WingspanBuilder, businessFilter: BusinessFilter): CashSettings {
	const resolver = new CashSettingsResolver();
	const entityCashSettings = new EntityCashSettings(resolver);
	const launcher = app.addShared(new CashSettingsLauncher(app.window, app.dataService, resolver, entityCashSettings, businessFilter.view, app.formatter));
	return { resolver, entityCashSettings, launcher };
}
