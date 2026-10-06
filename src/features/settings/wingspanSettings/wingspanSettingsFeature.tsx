import type { WingspanDataService } from '../../../data/services/wingspanDataService';
import type { SettingsPage } from '../../../monarch/pages/settings/settingsPage';
import { Island } from '../../../monarch/ui/components/island';
import type { WingspanFeature } from '../../wingspanFeature';
import { WingspanSettingsPanel } from './components/wingspanSettingsPanel';
import type { ProblemReport } from './services/problemReport';

/** The URL slug for Wingspan's page in Monarch's settings. */
export const WINGSPAN_SETTINGS_SLUG = 'wingspan';

const SETTINGS_TITLE = 'Wingspan';
const SETTINGS_LINKS = [{ label: 'General', slug: WINGSPAN_SETTINGS_SLUG }];

/** Wingspan's own page in Monarch's settings: where it saves, its version and a link to report a problem. */
export class WingspanSettingsFeature implements WingspanFeature {
	public constructor(
		private readonly page: SettingsPage,
		private readonly dataService: WingspanDataService,
		private readonly problemReport: ProblemReport,
		private readonly version: string
	) {}

	/** Nothing to subscribe to: the panel subscribes to the data service itself. */
	public start(): void {}

	/** Adds Wingspan's links card on any settings page, and its page card while that page is open. */
	public sync(): void {
		if (!this.page.isActive) {
			this.remove();
			return;
		}

		this.page.showLinksCard(SETTINGS_TITLE, SETTINGS_LINKS);
		if (!this.page.isOpen(WINGSPAN_SETTINGS_SLUG)) {
			this.page.removePageCard();
			return;
		}

		this.page.showPageCard({
			title: SETTINGS_TITLE,
			render: bodyEl => {
				const settingsIsland = new Island(bodyEl);
				settingsIsland.render(<WingspanSettingsPanel dataService={this.dataService} version={this.version} reportProblemUrl={this.problemReport.url} />);
				return () => settingsIsland.unmount();
			}
		});
	}

	public [Symbol.dispose](): void {
		this.remove();
	}

	private remove(): void {
		this.page.removeLinksCard();
		this.page.removePageCard();
	}
}
