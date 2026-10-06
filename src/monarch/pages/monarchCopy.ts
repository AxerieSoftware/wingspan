import { WINGSPAN_PARTS_SELECTOR } from './wingspanAttributes';

/** Clones one of Monarch's elements for Wingspan to fill in. Strips ids, which must stay unique, and anything Wingspan added or hid inside it. */
export function copyMonarchElement<TElement extends HTMLElement>(monarchEl: TElement): TElement {
	const copyEl = monarchEl.cloneNode(true) as TElement;
	copyEl.querySelectorAll(WINGSPAN_PARTS_SELECTOR).forEach(partEl => partEl.remove());
	for (const el of [copyEl, ...copyEl.querySelectorAll<HTMLElement>('*')]) {
		el.removeAttribute('id');
		// Monarch never sets inline !important styles; only Wingspan's StyleOverrides do.
		for (const property of [...el.style]) if (el.style.getPropertyPriority(property) === 'important') el.style.removeProperty(property);
	}
	return copyEl;
}
