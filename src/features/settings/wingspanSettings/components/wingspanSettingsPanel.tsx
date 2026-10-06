import type { WingspanDataService } from '../../../../data/services/wingspanDataService';
import { Fieldset } from '../../../../monarch/ui/components/fieldset';
import { Spinner } from '../../../../monarch/ui/components/spinner';
import { useSignalValue } from '../../../../monarch/ui/hooks/useSignalValue';
import { WingspanAccountLink } from './wingspanAccountLink';

/** reportProblemUrl opens a new GitHub issue with the versions filled in. */
export interface WingspanSettingsPanelProps {
	dataService: WingspanDataService;
	version: string;
	reportProblemUrl: string;
}

/** Shows where Wingspan saves its data and the sync status, plus the version and a link to report a problem. */
export function WingspanSettingsPanel({ dataService, version, reportProblemUrl }: WingspanSettingsPanelProps) {
	const storageStatus = useSignalValue(dataService.status);

	return (
		<div className="flex flex-col gap-xl">
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
