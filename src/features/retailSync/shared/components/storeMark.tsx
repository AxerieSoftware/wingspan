import type { Retailer } from '../models/retailSyncMessages';

const SIZE = 16;
const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];

export interface StoreMarkProps {
	retailer: Retailer;
}

/** A store's logo next to its name in the Sync retailer menu, gray like the Wingspan logo. Decorative. */
export function StoreMark({ retailer }: StoreMarkProps) {
	return (
		<svg viewBox="0 0 32 32" width={SIZE} height={SIZE} fill="currentColor" aria-hidden="true" className="shrink-0 text-content-secondary">
			{retailer === 'walmart' ? (
				<g transform="translate(16 16)">
					{SPARK_ANGLES.map(angle => (
						<rect key={angle} x="-2.8" y="-15.5" width="5.6" height="10" rx="2.8" transform={`rotate(${angle})`} />
					))}
				</g>
			) : (
				<path d="M23.4 9.6a9.4 9.4 0 1 0 0 12.8" fill="none" stroke="currentColor" strokeWidth="6.4" strokeLinecap="round" />
			)}
		</svg>
	);
}
