import type { ReactNode } from 'react';
import { WingspanAttribute } from '../../pages/wingspanAttributes';
import { Island } from './island';

const OPEN_POPUP_SELECTOR = '[data-mds="dialog"], [data-mds="alert-dialog"], [data-mds="popover-content"], [data-mds$="-popup"][data-open], [role="menu"], [role="listbox"]';

/** A React root on its own element at the end of the page body, for dialogs Wingspan opens. */
export class Layer {
	private static readonly openLayers = new Set<Layer>();
	private readonly hostEl: HTMLElement;
	private readonly island: Island;
	private isOpen = true;

	public constructor(document: Document, render: (close: () => void) => ReactNode) {
		this.hostEl = document.createElement('div');
		this.hostEl.setAttribute(WingspanAttribute.layer, '');
		document.body.append(this.hostEl);

		this.island = new Island(this.hostEl);
		this.island.render(render(() => this.close()));
		Layer.openLayers.add(this);
	}

	/** Closes every dialog Wingspan has open, e.g. when the page goes stale and they can no longer save. */
	public static closeAll(): void {
		for (const layer of Layer.openLayers) layer.close();
	}

	/** Whether any dialog, menu or popover, Monarch's or Wingspan's, is open on the page. */
	public static isPopupOpen(document: Document): boolean {
		return document.querySelector(OPEN_POPUP_SELECTOR) !== null;
	}

	/** Unmounts the content and removes its element. Closing again does nothing. */
	public close(): void {
		if (!this.isOpen) return;

		this.isOpen = false;
		Layer.openLayers.delete(this);
		this.island.unmount();
		this.hostEl.remove();
	}
}
