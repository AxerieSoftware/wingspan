import { effect } from '@preact/signals-core';
import type { StorageStatus, WingspanDataService } from '../../../data/services/wingspanDataService';
import type { SettingsPage } from '../../../monarch/pages/settings/settingsPage';
import { WingspanAttribute } from '../../../monarch/pages/wingspanAttributes';
import { Island } from '../../../monarch/ui/components/island';
import { ToastHost, type ToastService, UNTIL_DISMISSED } from '../../../monarch/ui/components/toast';
import type { WingspanFeature } from '../../wingspanFeature';
import { WINGSPAN_SETTINGS_SLUG } from './wingspanSettingsFeature';

/** Storage toasts: save failures that stay up until saving works again or the toast is dismissed. */
export class StorageNoticesFeature implements WingspanFeature {
	private readonly subscriptions = new DisposableStack();
	private failure: { toastId: string; message: string } | null = null;

	public constructor(
		private readonly window: Window,
		private readonly dataService: WingspanDataService,
		private readonly toastService: ToastService,
		private readonly settingsPage: SettingsPage
	) {}

	/** Puts the toast host on the page and shows failures as the data service reports them. */
	public start(): void {
		const toastsHostEl = this.window.document.createElement('div');
		toastsHostEl.setAttribute(WingspanAttribute.toasts, '');
		this.window.document.body.append(toastsHostEl);
		const toastsIsland = new Island(toastsHostEl);
		toastsIsland.render(<ToastHost toastService={this.toastService} />);
		this.subscriptions.defer(() => {
			toastsIsland.unmount();
			toastsHostEl.remove();
		});

		this.subscriptions.defer(
			effect(() => {
				const status = this.dataService.status.value;
				if (status.state === 'error') this.showFailure(status);
				else if (status.state === 'idle') this.closeFailure();
			})
		);
	}

	/** Nothing to sync: the toasts don't depend on the page. */
	public sync(): void {}

	public [Symbol.dispose](): void {
		this.subscriptions.dispose();
	}

	/** The data service's message says what failed and what happened to the household's data. */
	private showFailure({ message = "Wingspan couldn't save." }: StorageStatus): void {
		if (this.failure?.message === message) return;
		this.closeFailure();
		const toastId = this.toastService.show({ title: message, icon: 'help', action: { label: 'Settings', onClick: () => this.settingsPage.open(WINGSPAN_SETTINGS_SLUG) } }, UNTIL_DISMISSED);
		if (toastId) this.failure = { toastId, message };
	}

	private closeFailure(): void {
		if (!this.failure) return;
		this.toastService.close(this.failure.toastId);
		this.failure = null;
	}
}
