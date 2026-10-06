import type { ReadonlySignal } from '@preact/signals-core';
import { ButtonMenu } from '../../../../monarch/ui/components/menu';
import { useSignalValue } from '../../../../monarch/ui/hooks/useSignalValue';
import { WingspanMark } from '../../../wingspanMark';
import type { Retailer } from '../models/retailSyncMessages';
import type { RetailSyncState } from '../models/retailSyncState';
import { StoreMark } from './storeMark';

export interface RetailSyncActivity {
	store: string;
	state: RetailSyncState;
}

export interface RetailSyncControlProps {
	stores: { retailer: Retailer; name: string; onSync(): void }[];
	/** The store syncing now, if one is. */
	activity: ReadonlySignal<RetailSyncActivity | null>;
}

/** The "Sync retailer" menu next to Monarch's Settings: lists supported stores and shows sync progress. */
export function RetailSyncControl({ stores, activity: activitySignal }: RetailSyncControlProps) {
	const activity = useSignalValue(activitySignal);
	return (
		<>
			<span role="status" className="text-sm font-book text-content-secondary">
				{activity ? statusText(activity) : ''}
			</span>
			<ButtonMenu
				label="Sync retailer"
				leading={<WingspanMark />}
				loading={activity !== null}
				items={stores.map(store => ({ label: store.name, leading: <StoreMark retailer={store.retailer} />, onClick: store.onSync }))}
			/>
		</>
	);
}

function statusText({ store, state }: RetailSyncActivity): string {
	switch (state.phase) {
		case 'idle':
			return '';
		case 'waiting':
			return `Opening ${store}…`;
		case 'reading':
			return state.found ? `Read ${state.fetched} of ${state.found} ${store} purchases · sent ${state.sent}` : `Reading your ${store} purchase history…`;
	}
}
