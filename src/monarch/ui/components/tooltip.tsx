import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { usePortalPlacement } from '../portalContainer';
import { tooltipStyles } from '../styles';

/** The child is used as the trigger, so it must forward the props and ref it receives. */
export interface TooltipProps {
	label: string;
	delay?: number;
	children: ReactElement<Record<string, unknown>>;
}

export interface TooltipButtonProps {
	label: string;
	className?: string;
	children: ReactNode;
}

/** An icon with a keyboard-accessible tooltip: focusing it shows the tooltip, and screen readers read the label. */
export function TooltipButton({ label, className = '', children }: TooltipButtonProps) {
	return (
		<Tooltip label={label}>
			<button type="button" className={`inline-flex shrink-0 cursor-default border-0 bg-transparent p-0 text-inherit ${className}`.trim()} aria-label={label}>
				{children}
			</button>
		</Tooltip>
	);
}

/** Monarch's dark frosted tooltip, shown above the child on hover or focus. */
export function Tooltip({ label, delay = 200, children }: TooltipProps) {
	const portalPlacement = usePortalPlacement();
	const tooltipSlots = tooltipStyles();

	return (
		<BaseTooltip.Root>
			<BaseTooltip.Trigger delay={delay} closeDelay={0} render={children} />
			<BaseTooltip.Portal container={portalPlacement.container}>
				<div className="contents" data-theme="dark">
					<BaseTooltip.Positioner positionMethod={portalPlacement.positionMethod} side="top" sideOffset={6} className={tooltipSlots.positioner()}>
						<BaseTooltip.Popup data-mds="tooltip-content" className={tooltipSlots.content()}>
							{label}
						</BaseTooltip.Popup>
					</BaseTooltip.Positioner>
				</div>
			</BaseTooltip.Portal>
		</BaseTooltip.Root>
	);
}
