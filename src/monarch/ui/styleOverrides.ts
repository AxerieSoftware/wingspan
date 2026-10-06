interface OriginalStyle {
	value: string;
	priority: string;
}

/**
 * Sets inline `!important` styles on Monarch's elements, the only way to override its layered utility classes.
 * Remembers each element's original inline style so `restore` can put it back.
 */
export class StyleOverrides {
	private readonly originalStylesByElement = new Map<HTMLElement, Map<string, OriginalStyle>>();

	/** Sets the property with `!important`, remembering the element's own value the first time. */
	public set(targetEl: HTMLElement, property: string, value: string): void {
		let originalStyles = this.originalStylesByElement.get(targetEl);
		if (!originalStyles) {
			this.forgetDetachedElements();
			originalStyles = new Map();
			this.originalStylesByElement.set(targetEl, originalStyles);
		}

		if (!originalStyles.has(property)) originalStyles.set(property, { value: targetEl.style.getPropertyValue(property), priority: targetEl.style.getPropertyPriority(property) });
		if (targetEl.style.getPropertyValue(property) === value && targetEl.style.getPropertyPriority(property) === 'important') return;
		targetEl.style.setProperty(property, value, 'important');
	}

	public restore(): void {
		this.restoreExcept(new Set());
	}

	/** Restores every element's original style except those still being overridden, so those aren't rewritten. */
	public restoreExcept(keptEls: ReadonlySet<HTMLElement>): void {
		for (const [targetEl, originalStyles] of this.originalStylesByElement) {
			if (keptEls.has(targetEl)) continue;
			for (const [property, originalStyle] of originalStyles) {
				if (originalStyle.value) targetEl.style.setProperty(property, originalStyle.value, originalStyle.priority);
				else targetEl.style.removeProperty(property);
			}
			this.originalStylesByElement.delete(targetEl);
		}
	}

	private forgetDetachedElements(): void {
		for (const targetEl of this.originalStylesByElement.keys()) {
			if (!targetEl.isConnected) this.originalStylesByElement.delete(targetEl);
		}
	}
}
