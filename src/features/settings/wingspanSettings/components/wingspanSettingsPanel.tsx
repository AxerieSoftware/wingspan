import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import { CheckboxLabel } from '../../../../monarch/ui/components/checkbox';
import { Fieldset } from '../../../../monarch/ui/components/fieldset';
import { Spinner } from '../../../../monarch/ui/components/spinner';
import { SwitchRow } from '../../../../monarch/ui/components/switch';
import { useSignalValue } from '../../../../monarch/ui/hooks/useSignalValue';
import type { BusinessEntityView } from '../../../businessEntities/services/businessEntityView';
import type { HiddenSidebarItems } from '../../../sidebar/hiddenItems/services/hiddenSidebarItems';
import { WingspanAccountLink } from './wingspanAccountLink';

/** reportProblemUrl opens a new GitHub issue with the versions filled in. */
export interface WingspanSettingsPanelProps {
	dataService: WingspanDataService;
	businessView: BusinessEntityView;
	hiddenSidebarItems: HiddenSidebarItems;
	version: string;
	reportProblemUrl: string;
}

/** The body of Wingspan's page in Monarch's settings. */
export function WingspanSettingsPanel({ dataService, businessView, hiddenSidebarItems, version, reportProblemUrl }: WingspanSettingsPanelProps) {
	const storageStatus = useSignalValue(dataService.status);
	const businesses = useSignalValue(businessView.businesses);
	const workspacesEnabled = useSignalValue(businessView.isEnabled);
	const sidebarItems = useSignalValue(hiddenSidebarItems.items);
	const hiddenIds = useSignalValue(hiddenSidebarItems.hidden);

	return (
		<div className="flex flex-col gap-xl">
			{businesses?.length ? (
				<Fieldset legend="Business workspaces">
					<SwitchRow label="Keep the household and businesses separate" checked={workspacesEnabled} onChange={isEnabled => businessView.setEnabled(isEnabled)} />
					<p className="m-0 text-sm text-content-secondary">
						Adds a switcher to the top of the sidebar. Supported pages then show the household or one business, never both, and the rest say so in their header. Saved for this browser.
					</p>
				</Fieldset>
			) : null}
			{sidebarItems.length ? (
				<Fieldset legend="Sidebar">
					<p className="m-0 text-sm text-content-secondary">Uncheck what you don't use to hide it from the sidebar. Hidden pages still open from links. Saved for this browser.</p>
					<div className="grid grid-cols-2 gap-xs">
						{sidebarItems.map(item => (
							<CheckboxLabel key={item.id} label={item.label} checked={!hiddenIds.includes(item.id)} onChange={isShown => hiddenSidebarItems.setHidden(item.id, !isShown)} />
						))}
					</div>
				</Fieldset>
			) : null}
			<Fieldset legend="Where Wingspan saves">
				<p className="m-0 text-sm text-content-secondary">
					Wingspan saves to your Monarch account, in a hidden account named wingspan that's excluded from net worth. Every browser you use Wingspan in, and everyone in your household, sees the same
					data.
				</p>
				<div className="flex flex-wrap items-center gap-x-md gap-y-2xs text-sm">
					{storageStatus.state === 'busy' ? (
						<span className="inline-flex items-center gap-2xs text-content-secondary">
							<Spinner size="2xs" />
							Syncing with Monarch…
						</span>
					) : null}
					{storageStatus.state === 'error' ? <span className="text-content-danger">{storageStatus.message}</span> : null}
					{storageStatus.accountId ? <WingspanAccountLink accountId={storageStatus.accountId} className="font-medium text-content-link" /> : null}
				</div>
			</Fieldset>
			<Fieldset legend="About">
				<div className="flex items-center gap-xs text-base text-content-primary">
					{`Wingspan ${version}`}
					<span data-mds="badge" className="inline-flex shrink-0 items-center gap-2xs rounded-sm bg-background-info px-xs py-2xs text-content-info">
						<span data-mds="badge-label" className="text-xs font-medium">
							Beta
						</span>
					</span>
				</div>
				<p className="m-0 text-sm text-content-secondary">Wingspan is in beta, so some things may not work as expected yet. If something looks wrong, let us know.</p>
				<a className="text-sm font-medium text-content-link" href={reportProblemUrl} target="_blank" rel="noopener noreferrer">
					Report a problem
				</a>
			</Fieldset>
		</div>
	);
}
