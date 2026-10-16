import type { ReactNode } from 'react';
import { badgeStyles } from '../styles';

export interface BadgeProps {
	children: ReactNode;
	/** `count` is Monarch's orange count, as beside Recurring in the sidebar; `info` its blue tag, as on Recurring 2.0's Beta. */
	tone: 'count' | 'info';
	/** Read instead of the badge's text, when the text alone doesn't say what it counts. */
	label?: string;
}

/** Monarch's small badge. */
export function Badge({ children, tone, label }: BadgeProps) {
	return (
		<span data-mds="badge" title={label} className={badgeStyles({ tone })}>
			<span data-mds="badge-label" aria-hidden={label ? true : undefined} className="text-xs font-medium">
				{children}
			</span>
			{label ? <span className="sr-only">{label}</span> : null}
		</span>
	);
}
