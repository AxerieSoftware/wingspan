import { StyleOverrides } from '../../ui/styleOverrides';
import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2AddDialogExtension, RecurringV2AddDialogSlots } from './models/recurringV2AddDialogExtension';
import { RECURRING_V2_SELECTORS as SELECTORS } from './recurringV2Selectors';

const OWN_ATTRIBUTES = [WingspanAttribute.addChoice, WingspanAttribute.addFields, WingspanAttribute.addFooter];

interface OpenAddDialog {
	dialogEl: HTMLElement;
	bodyContentEl: HTMLElement;
	footerEl: HTMLElement;
	slots: RecurringV2AddDialogSlots;
	unmount: () => void;
}

/*
 * Monarch's "Add recurring" dialog, opened from Add recurring -> Add manually
 *
 * +- dialogEl ------------------------------------------------+
 * | Add recurring                                         [x] |
 * | +- choiceEl (Wingspan) --------------------------------+  |
 * | | Type [ Recurring merchant | Bill | Card payment ]    |  |
 * | +------------------------------------------------------+  |
 * | Merchant [...]          Name and icon [...]   <- Monarch's |
 * | Its transactions, the match card                fields     |
 * | +- fieldsEl (Wingspan) --------------------------------+  |
 * | | shown in their place for Wingspan's types            |  |
 * | +------------------------------------------------------+  |
 * +- footerEl ------------------------------------------------+
 * | Status [Active]             [Cancel] [Add recurring]       |
 * | Wingspan's footer replaces it for Wingspan's types         |
 * +-----------------------------------------------------------+
 */
export class RecurringV2AddDialog {
	private readonly hiddenStyles = new StyleOverrides();
	private openDialog: OpenAddDialog | null = null;
	private isShowingWingspanFields = false;

	public constructor(private readonly document: Document) {}

	/** Adds Wingspan's parts to the open dialog once, and again only when Monarch redraws it. */
	public extend(extension: RecurringV2AddDialogExtension): void {
		if (this.openDialog && !this.openDialog.dialogEl.isConnected) this.remove();

		const footerEl = this.document.querySelector<HTMLElement>(SELECTORS.addDialogFooter);
		const dialogEl = footerEl?.closest<HTMLElement>(SELECTORS.dialog);
		const bodyContentEl = dialogEl?.querySelector(SELECTORS.addDialogMerchantField)?.parentElement?.parentElement;
		if (!footerEl || !dialogEl || !bodyContentEl) return;
		// The same dialog keeps Wingspan's parts unless Monarch re-rendered its body or footer, which going back a step can do.
		const isStillMounted = this.openDialog?.dialogEl === dialogEl && this.openDialog.slots.choiceEl.isConnected && this.openDialog.slots.footerEl.isConnected;
		if (isStillMounted) {
			this.applyVisibility();
			return;
		}
		if (this.openDialog?.dialogEl === dialogEl) this.remove();

		const choiceEl = this.createSlotEl(WingspanAttribute.addChoice);
		const fieldsEl = this.createSlotEl(WingspanAttribute.addFields);
		const ownFooterEl = this.createSlotEl(WingspanAttribute.addFooter);
		choiceEl.style.marginBottom = 'var(--space-md)';
		ownFooterEl.style.cssText = 'width: 100%; align-items: center; justify-content: space-between; gap: var(--space-xs)';
		bodyContentEl.prepend(choiceEl);
		choiceEl.after(fieldsEl);
		footerEl.append(ownFooterEl);

		const slots: RecurringV2AddDialogSlots = {
			choiceEl,
			fieldsEl,
			footerEl: ownFooterEl,
			dialogEl,
			showWingspanFields: isShown => {
				this.isShowingWingspanFields = isShown;
				this.applyVisibility();
			},
			close: () => dialogEl.querySelector<HTMLElement>(SELECTORS.dialogCloseTrigger)?.click()
		};
		this.openDialog = { dialogEl, bodyContentEl, footerEl, slots, unmount: () => undefined };
		this.isShowingWingspanFields = false;
		this.applyVisibility();
		this.openDialog.unmount = extension.render(slots);
	}

	/** Unmounts Wingspan's parts and shows Monarch's fields again. */
	public remove(): void {
		if (!this.openDialog) return;

		const { slots, unmount } = this.openDialog;
		this.openDialog = null;
		unmount();
		for (const slotEl of [slots.choiceEl, slots.fieldsEl, slots.footerEl]) slotEl.remove();
		this.hiddenStyles.restore();
	}

	// Monarch keeps rendering its own fields, so new ones are hidden on every sync.
	private applyVisibility(): void {
		if (!this.openDialog) return;

		const { dialogEl, bodyContentEl, footerEl, slots } = this.openDialog;
		slots.fieldsEl.hidden = !this.isShowingWingspanFields;
		slots.footerEl.style.display = this.isShowingWingspanFields ? 'flex' : 'none';
		if (!this.isShowingWingspanFields) {
			this.hiddenStyles.restore();
			return;
		}

		const monarchEls = [...bodyContentEl.children, ...footerEl.children, ...dialogEl.querySelectorAll(SELECTORS.dialogWash)].filter(
			(childEl): childEl is HTMLElement => childEl instanceof HTMLElement && !OWN_ATTRIBUTES.some(attribute => childEl.hasAttribute(attribute))
		);
		for (const monarchEl of monarchEls) this.hiddenStyles.set(monarchEl, 'display', 'none');
	}

	private createSlotEl(attribute: string): HTMLElement {
		const slotEl = this.document.createElement('div');
		slotEl.setAttribute(attribute, '');
		return slotEl;
	}
}
