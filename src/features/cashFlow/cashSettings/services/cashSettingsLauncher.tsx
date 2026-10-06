import { useState } from 'react';
import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import type { Account } from '../../../../monarch/api/models/account';
import type { BusinessEntity } from '../../../../monarch/api/models/businessEntity';
import { Layer } from '../../../../monarch/ui/components/layer';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { HOUSEHOLD_ENTITY_ID } from '../../../businessEntities/models/entityScope';
import type { BusinessEntityView } from '../../../businessEntities/services/businessEntityView';
import { CashSettingsDialog } from '../components/cashSettingsDialog';
import type { CashSettingsResolver } from './cashSettingsResolver';
import type { EntityCashSettings } from './entityCashSettings';

const HOUSEHOLD_LABEL = 'Household';

interface OwnedCashSettingsDialogProps {
	accounts: Account[];
	businesses: BusinessEntity[];
	initialOwnerId: string;
	dataService: WingspanDataService;
	cashSettingsResolver: CashSettingsResolver;
	entityCashSettings: EntityCashSettings;
	formatter: Formatter;
	onClose(): void;
}

/** Opens the cash and card settings for the part of the household being shown, or the household's own when more than one part is shown. */
export class CashSettingsLauncher implements Disposable {
	private openLayer: Layer | null = null;

	public constructor(
		private readonly window: Window,
		private readonly dataService: WingspanDataService,
		private readonly cashSettingsResolver: CashSettingsResolver,
		private readonly entityCashSettings: EntityCashSettings,
		private readonly businessEntityView: BusinessEntityView,
		private readonly formatter: Formatter
	) {}

	/** Opens on the shown part when only one is shown, otherwise on the household. Closes any dialog that's already open first. */
	public open(accounts: Account[]): void {
		const businesses = this.businessEntityView.businesses.peek() ?? [];
		const initialOwnerId = this.businessEntityView.scope.peek().soleEntityId ?? HOUSEHOLD_ENTITY_ID;
		this.openLayer?.close();
		this.openLayer = new Layer(this.window.document, close => (
			<OwnedCashSettingsDialog
				accounts={accounts}
				businesses={businesses}
				initialOwnerId={initialOwnerId}
				dataService={this.dataService}
				cashSettingsResolver={this.cashSettingsResolver}
				entityCashSettings={this.entityCashSettings}
				formatter={this.formatter}
				onClose={close}
			/>
		));
	}

	public [Symbol.dispose](): void {
		this.openLayer?.close();
		this.openLayer = null;
	}
}

/** Switching owners reloads the dialog with that owner's settings; unsaved changes to the previous owner's are discarded. */
function OwnedCashSettingsDialog({ accounts, businesses, initialOwnerId, dataService, cashSettingsResolver, entityCashSettings, formatter, onClose }: OwnedCashSettingsDialogProps) {
	const [ownerId, setOwnerId] = useState(initialOwnerId);
	const ownAccounts = entityCashSettings.accountsOf(accounts, ownerId);
	const ownerOptions = [[HOUSEHOLD_ENTITY_ID, HOUSEHOLD_LABEL] as const, ...businesses.map(business => [business.id, business.name] as const)];
	return (
		<CashSettingsDialog
			key={ownerId}
			ownerChoice={businesses.length ? { options: ownerOptions, value: ownerId, onChange: setOwnerId } : undefined}
			cashAccounts={cashSettingsResolver.cashAccounts(ownAccounts)}
			cardAccounts={cashSettingsResolver.cardAccounts(ownAccounts)}
			settings={entityCashSettings.forEntity(accounts, dataService.data.peek(), ownerId)}
			formatter={formatter}
			onSave={settings => dataService.update(data => entityCashSettings.withSaved(data, ownerId, settings))}
			onClose={onClose}
		/>
	);
}
