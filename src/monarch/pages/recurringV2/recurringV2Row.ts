import { WingspanAttribute } from '../wingspanAttributes';
import type { RecurringV2Item } from './models/recurringV2Item';
import { AMOUNT_CELL_PATTERN, RECURRING_V2_SELECTORS as SELECTORS, STATUS_DATE_PATTERN } from './recurringV2Selectors';

/** A row in a Recurring 2.0 section, Monarch's or Wingspan's, read from its markup. */
export class RecurringV2Row implements RecurringV2Item {
	/** Marks Wingspan's rows; its value is the row's key. */
	public static readonly ownRowAttribute = WingspanAttribute.row;
	/** The date a Wingspan row sorts by, as YYYY-MM-DD. */
	public static readonly ownRowDateAttribute = WingspanAttribute.rowDate;

	public constructor(public readonly rowEl: HTMLElement) {}

	public get isWingspanRow(): boolean {
		return this.rowEl.hasAttribute(RecurringV2Row.ownRowAttribute);
	}

	/** The date a Wingspan row sorts by; null on Monarch's rows. */
	public get wingspanRowDate(): string | null {
		return this.rowEl.getAttribute(RecurringV2Row.ownRowDateAttribute);
	}

	public get name(): string {
		return this.rowEl.firstElementChild?.querySelector(SELECTORS.rowName)?.textContent?.trim() ?? '';
	}

	/** The day of the month in the row's status, as in "Paid Sep 14", or null when it has none. */
	public get statusDay(): number | null {
		const statusText = this.rowEl.querySelector(SELECTORS.rowStatus)?.textContent ?? '';
		const statusDate = STATUS_DATE_PATTERN.exec(statusText);
		return statusDate ? Number(statusDate[2]) : null;
	}

	/** Read from the rightmost cell that holds only an amount. */
	public get amount(): number | null {
		for (const cellEl of [...this.rowEl.children].reverse()) {
			const amountText = AMOUNT_CELL_PATTERN.exec(cellEl.textContent?.trim() ?? '')?.[1];
			if (amountText) return Number(amountText.replaceAll(',', ''));
		}
		return null;
	}

	/** Wingspan's text at the end of the row's subtitle, or empty. */
	public get dueLabel(): string {
		return this.dueLabelEl?.textContent ?? '';
	}

	/** Replaces Wingspan's text at the end of the subtitle; an empty string removes it. */
	public set dueLabel(text: string) {
		if (this.dueLabel === text) return;
		this.dueLabelEl?.remove();

		const subtitleEl = this.subtitleEl;
		if (!text || !subtitleEl) return;

		const dueLabelEl = this.rowEl.ownerDocument.createElement('span');
		dueLabelEl.setAttribute(WingspanAttribute.due, '');
		dueLabelEl.textContent = text;
		subtitleEl.append(dueLabelEl);
	}

	private get subtitleEl(): HTMLElement | null {
		return this.rowEl.firstElementChild?.querySelector<HTMLElement>(SELECTORS.rowSubtitle) ?? null;
	}

	private get dueLabelEl(): HTMLElement | null {
		return this.subtitleEl?.querySelector<HTMLElement>(`[${WingspanAttribute.due}]`) ?? null;
	}
}
