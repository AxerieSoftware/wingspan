import { Toast as BaseToast } from '@base-ui/react/toast';
import { actionToastStyles } from '../styles';

const TOAST_TIMEOUT_MS = 15_000;
/** A timeout that keeps a toast open until it's acted on, dismissed or closed. */
export const UNTIL_DISMISSED = 0;
const DISMISS_LABEL = 'Dismiss';

/** A button on a toast. Clicking it also closes the toast. */
export interface ToastAction {
	label: string;
	onClick(): void;
}

export interface ToastHostProps {
	toastService: ToastService;
}

interface ToastData {
	action?: ToastAction;
}

/** Toasts for `ToastHost` to show, one at a time, from anywhere in Wingspan. */
export class ToastService {
	/** The Base UI toast manager `ToastHost` reads from. */
	public readonly manager = BaseToast.createToastManager();
	private hasShownLast = false;

	/** Returns the toast's ID, or null once `showLast` has run. */
	public show(message: string, action?: ToastAction, timeoutMs = TOAST_TIMEOUT_MS): string | null {
		if (this.hasShownLast) return null;
		return this.manager.add({ title: message, timeout: timeoutMs, data: { action } satisfies ToastData });
	}

	/** Replaces all toasts with this one, which stays open until it's acted on or dismissed. No toasts are shown after it. */
	public showLast(message: string, action: ToastAction): void {
		this.manager.close();
		this.show(message, action, UNTIL_DISMISSED);
		this.hasShownLast = true;
	}

	public close(toastId: string): void {
		this.manager.close(toastId);
	}
}

/** Monarch's dark action toast at the bottom of the page, each with a Dismiss button. */
export function ToastHost({ toastService }: ToastHostProps) {
	return (
		<BaseToast.Provider toastManager={toastService.manager} limit={1}>
			<BaseToast.Portal>
				<div className="contents" data-theme="dark">
					<BaseToast.Viewport data-mds="action-toast-viewport" className={actionToastStyles().viewport()}>
						<ToastList toastService={toastService} />
					</BaseToast.Viewport>
				</div>
			</BaseToast.Portal>
		</BaseToast.Provider>
	);
}

function ToastList({ toastService }: ToastHostProps) {
	const { toasts } = BaseToast.useToastManager();

	return toasts.map(toast => {
		const action = (toast.data as ToastData | undefined)?.action;
		const actions = [...(action ? [action] : []), { label: DISMISS_LABEL, onClick: () => {} }];
		const toastSlots = actionToastStyles({ hasActions: true });

		return (
			<BaseToast.Root key={toast.id} toast={toast} swipeDirection={[]} data-mds="action-toast" className={toastSlots.root()}>
				<BaseToast.Title data-mds="action-toast-message" className={toastSlots.message()}>
					{toast.title}
				</BaseToast.Title>
				<div data-mds="action-toast-actions" className={toastSlots.actions()}>
					{actions.map(({ label, onClick }) => (
						<button
							key={label}
							type="button"
							data-mds="action-toast-action"
							className={toastSlots.action()}
							onClick={() => {
								toastService.close(toast.id);
								onClick();
							}}
						>
							{label}
						</button>
					))}
				</div>
			</BaseToast.Root>
		);
	});
}
