import { computed } from '@preact/signals-core';
import type { ReceiptsPage } from '../../../monarch/pages/transactions/receiptsPage';
import { Island } from '../../../monarch/ui/components/island';
import type { WingspanFeature } from '../../wingspanFeature';
import { type RetailSyncActivity, RetailSyncControl } from './components/retailSyncControl';
import type { RetailSyncSession } from './retailSyncSession';

/** One "Sync retailer" menu on Transactions → Receipts and Retail Sync for all supported stores. Only one store syncs at a time. */
export class RetailSyncFeature implements WingspanFeature {
	private readonly activity = computed((): RetailSyncActivity | null => {
		const running = this.sessions.find(session => session.state.value.phase !== 'idle');
		return running ? { store: running.displayName, state: running.state.value } : null;
	});

	public constructor(
		private readonly sessions: RetailSyncSession[],
		private readonly page: ReceiptsPage
	) {}

	public start(): void {
		for (const session of this.sessions) session.listen();
	}

	/** Shows the menu on Receipts and Retail Sync and removes it on other pages. */
	public sync(): void {
		if (!this.page.isActive) {
			this.page.removeControl();
			return;
		}
		this.page.showControl({ render: hostEl => this.mount(hostEl) });
	}

	public [Symbol.dispose](): void {
		for (const session of this.sessions) session[Symbol.dispose]();
		this.page.removeControl();
	}

	private mount(hostEl: HTMLElement): () => void {
		const island = new Island(hostEl);
		const stores = this.sessions.map(session => ({ retailer: session.retailer, name: session.displayName, onSync: () => void this.startSync(session) }));
		island.render(<RetailSyncControl stores={stores} activity={this.activity} />);
		return () => island.unmount();
	}

	private startSync(session: RetailSyncSession): Promise<void> | undefined {
		if (this.activity.peek()) return;
		return session.sync();
	}
}
