/** Wingspan's content for a host element it adds to Monarch's page; returns its unmount. */
export interface SlotContent {
	render(hostEl: HTMLElement): () => void;
}

interface SlotOptions {
	tagName?: 'div' | 'span';
	className?: string;
	style?: string;
}

/** A host element of Wingspan's and the content rendered into it. */
export class MountedSlot {
	private constructor(
		public readonly hostEl: HTMLElement,
		private readonly unmountContent: () => void
	) {}

	/** Creates the host, marks it with Wingspan's attribute and renders the content; the caller puts it in the page. */
	public static mount(document: Document, content: SlotContent, ownAttribute: string, { tagName = 'div', className, style }: SlotOptions = {}): MountedSlot {
		const hostEl = document.createElement(tagName);
		if (className) hostEl.className = className;
		if (style) hostEl.style.cssText = style;
		hostEl.setAttribute(ownAttribute, '');
		return new MountedSlot(hostEl, content.render(hostEl));
	}

	public remove(): void {
		this.unmountContent();
		this.hostEl.remove();
	}
}
