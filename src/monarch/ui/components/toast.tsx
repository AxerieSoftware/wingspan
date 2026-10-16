import { Toast as BaseToast } from '@base-ui/react/toast';
import { toastStyles } from '../styles';
import { BellIcon, CloseIcon, HelpCircleIcon } from './icons';

const TOAST_TIMEOUT_MS = 15_000;
/** A timeout that keeps a toast open until it's acted on or closed. */
export const UNTIL_DISMISSED = 0;

/** A button on a toast. Clicking it also closes the toast. */
export interface ToastAction {
	label: string;
	onClick(): void;
}

/**
 * What a toast says. Like Monarch's, a toast that asks for an action leads with a question mark, and one about an update
 * with a bell.
 */
export interface ToastContent {
	title: string;
	description?: string;
	icon: 'help' | 'bell';
	action?: ToastAction;
}

export interface ToastHostProps {
	toastService: ToastService;
}

/** Toasts for `ToastHost` to show, one at a time, from anywhere in Wingspan. */
export class ToastService {
	/** The Base UI toast manager `ToastHost` reads from. */
	public readonly manager = BaseToast.createToastManager();
	private hasShownLast = false;

	/** Returns the toast's ID, or null once `showLast` has run. */
	public show(content: ToastContent, timeoutMs = TOAST_TIMEOUT_MS): string | null {
		if (this.hasShownLast) return null;
		return this.manager.add({ title: content.title, description: content.description, timeout: timeoutMs, data: content });
	}

	/** Replaces all toasts with this one, which stays open until it's acted on or closed. No toasts are shown after it. */
	public showLast(content: ToastContent): void {
		this.manager.close();
		this.show(content, UNTIL_DISMISSED);
		this.hasShownLast = true;
	}

	public close(toastId: string): void {
		this.manager.close(toastId);
	}
}

/** Monarch's toasts at the bottom right, in its dark theme on every page like Monarch's own. */
export function ToastHost({ toastService }: ToastHostProps) {
	return (
		<BaseToast.Provider toastManager={toastService.manager} limit={1}>
			<BaseToast.Portal>
				<div className="contents" data-theme="dark">
					<BaseToast.Viewport data-mds="toast-viewport" className={toastStyles().viewport()}>
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
		const content = toast.data as ToastContent;
		const toastSlots = toastStyles({ icon: content.icon });
		const action = content.action;

		return (
			<BaseToast.Root key={toast.id} toast={toast} swipeDirection={[]} data-mds="toast" data-variant={content.icon === 'help' ? 'info' : 'default'} className={toastSlots.root()}>
				<div data-mds="toast-content" className={toastSlots.content()}>
					<span data-mds="toast-icon" className={toastSlots.iconSlot()}>
						{content.icon === 'help' ? <HelpCircleIcon /> : <BellIcon />}
					</span>
					<div data-mds="toast-body" className={toastSlots.body()}>
						<div data-mds="toast-text" className={toastSlots.text()}>
							<BaseToast.Title data-mds="toast-title" className={toastSlots.title()}>
								{toast.title}
							</BaseToast.Title>
							{toast.description ? (
								<BaseToast.Description data-mds="toast-description" className={toastSlots.description()}>
									{toast.description}
								</BaseToast.Description>
							) : null}
						</div>
						{action ? (
							<div data-mds="toast-actions" className={toastSlots.actionsPanel()}>
								<button
									type="button"
									data-mds="toast-action"
									className={toastSlots.action()}
									onClick={() => {
										toastService.close(toast.id);
										action.onClick();
									}}
								>
									{action.label}
								</button>
							</div>
						) : null}
					</div>
					<BaseToast.Close data-mds="toast-close" aria-label="Close notification" className={toastSlots.closeButton()}>
						<CloseIcon />
					</BaseToast.Close>
				</div>
			</BaseToast.Root>
		);
	});
}
