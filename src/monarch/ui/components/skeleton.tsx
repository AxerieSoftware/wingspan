import type { CSSProperties } from 'react';
import { classNames, skeletonStyles } from '../styles';

/** The placeholder's size, set by a class or inline style. */
export interface SkeletonProps {
	className?: string;
	style?: CSSProperties;
}

/** Monarch's shimmering placeholder for a block that's still loading. */
export function Skeleton({ className, style }: SkeletonProps) {
	return <div data-mds="skeleton" aria-hidden="true" className={skeletonStyles({ className })} style={style} />;
}

/** A loading placeholder one line of text tall, so its font size sets its height. */
export function SkeletonText({ className, style }: SkeletonProps) {
	return <div data-mds="skeleton-text" aria-hidden="true" className={skeletonStyles({ className: classNames('inline-block h-[1em] rounded-sm align-middle', className) })} style={style} />;
}
