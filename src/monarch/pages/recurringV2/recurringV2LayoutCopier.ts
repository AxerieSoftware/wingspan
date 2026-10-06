const COPIED_LAYOUT_PROPERTIES = ['grid-template-columns', 'min-width'];

/** Gives Wingspan's elements the class and grid of Monarch's, so their columns line up. */
export class RecurringV2LayoutCopier {
	/** Copies the grid columns and min width, and the class too when asked; writes only what differs. */
	public copy(fromEl: HTMLElement, toEl: HTMLElement, includeClassName: boolean): void {
		if (includeClassName && toEl.className !== fromEl.className) toEl.className = fromEl.className;
		for (const property of COPIED_LAYOUT_PROPERTIES) {
			const value = fromEl.style.getPropertyValue(property);
			if (toEl.style.getPropertyValue(property) !== value) toEl.style.setProperty(property, value);
		}
	}
}
