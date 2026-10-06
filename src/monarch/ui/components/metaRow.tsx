import type { ReactNode } from 'react';
import { metaRowStyles } from '../styles';

/** A text value truncates and shows in full on hover. */
export interface MetaRowProps {
	label: string;
	children: ReactNode;
}

/** A meta row's label and value, for a caller that supplies its own row element. */
export function MetaRowContent({ label, children }: MetaRowProps) {
	const metaRowSlots = metaRowStyles();

	return (
		<>
			<span className={metaRowSlots.label()}>{label}</span>
			<div className={metaRowSlots.value()}>
				{typeof children === 'string' ? (
					<span className={metaRowSlots.text()} title={children}>
						{children}
					</span>
				) : (
					children
				)}
			</div>
		</>
	);
}

/** A label and value row like those in Monarch's details panel. */
export function MetaRow({ label, children }: MetaRowProps) {
	return (
		<div data-external-id="meta-row" className={metaRowStyles().root()}>
			<MetaRowContent label={label}>{children}</MetaRowContent>
		</div>
	);
}
