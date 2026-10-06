import { useId } from 'react';
import { spinnerStyles } from '../styles';

const HEAD_PATH = 'M 22 12 A 10 10 0 0 0 2 12';
const TAIL_PATH = 'M 2 12 A 10 10 0 0 0 22 12';

/** From 14px (`2xs`) to 40px (`xl`). */
export type SpinnerSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/** `inverse` is for a spinner on a filled button. */
export type SpinnerColor = 'blue' | 'neutral' | 'inverse';

/** Defaults to the small gray spinner buttons use. */
export interface SpinnerProps {
	size?: SpinnerSize;
	color?: SpinnerColor;
	className?: string;
}

/** Monarch's loading spinner, a ring fading toward its tail. */
export function Spinner({ size = 'xs', color = 'neutral', className }: SpinnerProps) {
	const gradientId = useId();

	return (
		<svg data-mds="spinner" role="status" aria-label="Loading" viewBox="0 0 24 24" fill="none" className={spinnerStyles({ size, color, className })}>
			<defs>
				<linearGradient id={`${gradientId}-head`} gradientUnits="userSpaceOnUse" x1={2} y1={12} x2={22} y2={12}>
					<stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
					<stop offset="100%" stopColor="currentColor" stopOpacity={1} />
				</linearGradient>
				<linearGradient id={`${gradientId}-tail`} gradientUnits="userSpaceOnUse" x1={2} y1={12} x2={22} y2={12}>
					<stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
					<stop offset="50%" stopColor="currentColor" stopOpacity={0} />
				</linearGradient>
			</defs>
			<path data-mds="spinner-tail" d={TAIL_PATH} stroke={`url(#${gradientId}-tail)`} strokeWidth={2.5} />
			<path data-mds="spinner-head" d={HEAD_PATH} stroke={`url(#${gradientId}-head)`} strokeWidth={2.5} />
			<circle data-mds="spinner-head-cap" cx={22} cy={12} r={1.25} fill="currentColor" />
		</svg>
	);
}
