import type { ReactNode } from 'react';
import { bannerStyles } from '../styles';
import { InfoIcon } from './icons';

export interface BannerProps {
	children: ReactNode;
	/** Buttons at the banner's end, like Monarch's Open splits. */
	actions?: ReactNode;
}

/** Monarch's info banner, as in a transaction's details. Screen readers hear "Information:" first, as with Monarch's. */
export function Banner({ children, actions }: BannerProps) {
	const bannerSlots = bannerStyles();
	return (
		<div data-mds="banner" role="status" className={bannerSlots.root()}>
			<span data-mds="banner-icon" className={bannerSlots.icon()}>
				<InfoIcon size={16} />
			</span>
			<div data-mds="banner-content" className={bannerSlots.content()}>
				<span className="sr-only">Information:</span>
				<span data-mds="banner-description" className={bannerSlots.description()}>
					{children}
				</span>
			</div>
			{actions ? (
				<span data-mds="banner-actions" className={bannerSlots.actions()}>
					{actions}
				</span>
			) : null}
		</div>
	);
}
