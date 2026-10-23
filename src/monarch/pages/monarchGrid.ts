const GRID_ITEM_SELECTOR = '[data-external-id="grid-item"]';
const FLEX_CONTAINER_SELECTOR = '[data-external-id="flex-container-base"]';

/**
 * The item in the grid of Monarch's page layouts with that area name, like "chart". Monarch names the area in an inline
 * style, and browsers write that style back differently (WebKit spells `grid-area` out as its four longhands), so the
 * area is read from the style object rather than matched in the attribute's text.
 */
export function gridItem(document: Document, area: string): HTMLElement | null {
	return [...document.querySelectorAll<HTMLElement>(GRID_ITEM_SELECTOR)].find(itemEl => itemEl.style.gridRowStart === area) ?? null;
}

/** The row of cards directly inside the grid item with that area name. */
export function gridItemRow(document: Document, area: string): HTMLElement | null {
	return gridItem(document, area)?.querySelector<HTMLElement>(`:scope > ${FLEX_CONTAINER_SELECTOR}`) ?? null;
}
