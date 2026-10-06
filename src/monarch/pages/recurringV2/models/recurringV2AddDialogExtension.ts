export interface RecurringV2AddDialogSlots {
	choiceEl: HTMLElement;
	fieldsEl: HTMLElement;
	footerEl: HTMLElement;
	dialogEl: HTMLElement;
	showWingspanFields(isShown: boolean): void;
	close(): void;
}

/** Wingspan's content for the Add recurring dialog; render returns its unmount. */
export interface RecurringV2AddDialogExtension {
	render(slots: RecurringV2AddDialogSlots): () => void;
}
