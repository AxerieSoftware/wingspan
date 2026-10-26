import { type RefObject, useLayoutEffect, useState } from 'react';

/** The element's width in pixels, kept current as it resizes. 0 until it's rendered. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		setWidth(element.clientWidth);
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return width;
}
