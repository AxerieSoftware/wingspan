import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { useState } from 'react';
import { alertDialogStyles, buttonStyles } from '../styles';
import { Button } from './button';
import { Layer } from './layer';

export interface Confirmation {
	title: string;
	message: string;
	confirmLabel: string;
}

/** While `busy`, the dialog can't be closed and its confirm button shows a spinner. */
export interface ConfirmDialogProps {
	confirmation: Confirmation;
	open: boolean;
	busy?: boolean;
	onAnswer(confirmed: boolean): void;
}

interface StandaloneConfirmDialogProps {
	confirmation: Confirmation;
	action(): Promise<void>;
	onDone(): void;
}

/** Opens a standalone confirmation dialog, for code outside React. */
export class ConfirmPrompt {
	public constructor(private readonly document: Document) {}

	/** Opens the dialog. Confirming runs the action before the dialog closes. */
	public ask(confirmation: Confirmation, action: () => Promise<void>): Layer {
		return new Layer(this.document, close => <StandaloneConfirmDialog confirmation={confirmation} action={action} onDone={close} />);
	}
}

/** Monarch's alert dialog for confirming a destructive action, with a danger confirm button. */
export function ConfirmDialog({ confirmation, open, busy, onAnswer }: ConfirmDialogProps) {
	const alertDialogSlots = alertDialogStyles();

	return (
		<BaseAlertDialog.Root open={open} onOpenChange={isOpen => !isOpen && !busy && onAnswer(false)}>
			<BaseAlertDialog.Portal>
				<BaseAlertDialog.Backdrop data-mds="alert-dialog-backdrop" className={alertDialogSlots.backdrop()} />
				<BaseAlertDialog.Popup data-mds="alert-dialog" className={alertDialogSlots.popup()}>
					<div data-mds="alert-dialog-header" className={alertDialogSlots.header()}>
						<BaseAlertDialog.Title data-mds="alert-dialog-title" className={alertDialogSlots.title()}>
							{confirmation.title}
						</BaseAlertDialog.Title>
					</div>
					<div data-mds="alert-dialog-body" className={alertDialogSlots.body()}>
						<BaseAlertDialog.Description data-mds="alert-dialog-description" className={alertDialogSlots.description()}>
							{confirmation.message}
						</BaseAlertDialog.Description>
					</div>
					<div data-mds="alert-dialog-footer" className={alertDialogSlots.footer()}>
						<BaseAlertDialog.Close data-mds="alert-dialog-cancel" className={buttonStyles()} disabled={busy}>
							Cancel
						</BaseAlertDialog.Close>
						<Button data-mds="alert-dialog-confirm" variant="danger" loading={busy} onClick={() => onAnswer(true)}>
							{confirmation.confirmLabel}
						</Button>
					</div>
				</BaseAlertDialog.Popup>
			</BaseAlertDialog.Portal>
		</BaseAlertDialog.Root>
	);
}

function StandaloneConfirmDialog({ confirmation, action, onDone }: StandaloneConfirmDialogProps) {
	const [isBusy, setIsBusy] = useState(false);

	const answer = async (confirmed: boolean) => {
		try {
			if (confirmed) {
				setIsBusy(true);
				await action();
			}
		} finally {
			onDone();
		}
	};

	return <ConfirmDialog confirmation={confirmation} open busy={isBusy} onAnswer={answer} />;
}
