import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { dialogStyles, iconButtonStyles } from '../styles';
import { CloseIcon } from './icons';

export type DialogSize = 'sm' | 'md' | 'lg';

/** `actions` sit at the right of the footer; `footer` replaces the whole footer instead. */
export interface DialogProps {
	title: string;
	size?: DialogSize;
	className?: string;
	titleAdornment?: ReactNode;
	actions?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
	onClose(): void;
}

/** Monarch's modal dialog, open while mounted. Closing it calls `onClose`. */
export function Dialog({ title, titleAdornment, size, className, actions, footer, children, onClose }: DialogProps) {
	const dialogSlots = dialogStyles({ size });

	return (
		<BaseDialog.Root open onOpenChange={isOpen => !isOpen && onClose()}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop data-mds="dialog-backdrop" className={dialogSlots.backdrop()} />
				<BaseDialog.Viewport data-mds="dialog-viewport" data-scroll="inside" className={dialogSlots.viewport()}>
					<div className={dialogSlots.viewportInner()}>
						<BaseDialog.Popup data-mds="dialog" className={dialogSlots.popup({ className })}>
							<div data-mds="dialog-header" className={dialogSlots.header()}>
								<div className="flex min-w-0 items-center gap-xs">
									<BaseDialog.Title data-mds="dialog-title" className={dialogSlots.title()}>
										{title}
									</BaseDialog.Title>
									{titleAdornment}
								</div>
								<BaseDialog.Close data-mds="dialog-close-trigger" className={iconButtonStyles({ size: 'xs' })} aria-label="Close dialog">
									<span data-mds="icon-button-icon" aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={{ width: 16, height: 16 }}>
										<CloseIcon />
									</span>
								</BaseDialog.Close>
							</div>
							<div data-mds="dialog-body" className={dialogSlots.body()}>
								<div className={dialogSlots.bodyViewport()}>
									<div className={dialogSlots.bodyContent()}>{children}</div>
								</div>
							</div>
							<div data-mds="dialog-footer" className={`${dialogSlots.footer()} justify-between`}>
								{footer ?? <div className="ml-auto flex items-center gap-xs">{actions}</div>}
							</div>
						</BaseDialog.Popup>
					</div>
				</BaseDialog.Viewport>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}
