import { createContext, useContext } from 'react';

/** The Monarch dialog that contains Wingspan's content, if any, so popups can render inside it. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export interface PortalPlacement {
	container: HTMLElement | undefined;
	positionMethod: 'absolute' | undefined;
}

/** Inside a Monarch dialog, popups render in the dialog like Monarch's own do, so its focus trap and outside-click handling treat them as part of it. */
export function usePortalPlacement(): PortalPlacement {
	const container = useContext(PortalContainerContext);
	return { container: container ?? undefined, positionMethod: container ? 'absolute' : undefined };
}
