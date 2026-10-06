/** A section card's test id is this prefix and the section's name. */
export const SECTION_CARD_TEST_ID_PREFIX = 'recurring-section-card-';
/** A section's scroll area test id is this prefix and the section's name. */
export const SECTION_SCROLL_TEST_ID_PREFIX = 'recurring-section-scroll-';

export const RECURRING_V2_SELECTORS = {
	monthTitle: 'h1[data-external-id="recurring-list-title"]',
	sectionCard: `[data-testid^="${SECTION_CARD_TEST_ID_PREFIX}"]`,
	sectionScroll: `[data-testid^="${SECTION_SCROLL_TEST_ID_PREFIX}"]`,
	sectionRows: `[data-testid^="${SECTION_SCROLL_TEST_ID_PREFIX}"] > div`,
	headerGrid: '[data-external-id="recurring-section-list-header"] .grid',
	sectionTitle: '.text-lg',
	sectionCount: '.text-lg + span',
	rowButton: '[role="button"]',
	monarchRow: '[role="button"][data-selected]',
	rowName: '[data-mds="text"].block, span.block',
	rowSubtitle: '.flex-col > span:last-child',
	rowStatus: '[data-external-id="status-copy-text"]',
	rowMenuButton: '[data-external-id="recurring-section-row-menu"] button',
	comingSoon: '[data-external-id="recurring-coming-soon-content"]',
	sidebar: '[data-testid="recurring-tab-sidebar"]',
	summary: '[data-external-id="recurring-summary-sidebar"]',
	summaryRow: '[data-external-id="recurring-summary-sidebar-row"]',
	summaryText: '[data-mds="text"]',
	meter: '[role="meter"]',
	meterBar: '[data-external-id="progress-track"] > div',
	inactiveFooter: '[data-external-id="recurring-section-inactive-footer"]',
	pageControls: '[data-external-id="recurring-v2-page-controls"]',
	popoverTrigger: '[data-mds="popover-trigger"]',
	detailPanel: '[data-external-id="recurrence-group-detail-panel-view"]',
	detailMetaRow: '[data-external-id="meta-row"]',
	closeButton: '[data-external-id="mds-close-button"]',
	dialog: '[data-mds="dialog"]',
	dialogWash: '[data-mds="dialog-wash"]',
	dialogCloseTrigger: '[data-mds="dialog-close-trigger"]',
	addDialogFooter: '[data-external-id="add-recurring-group-footer"]',
	addDialogMerchantField: '[data-external-id="add-recurring-group-merchant-field"]'
} as const;

/** A cell holding only an amount, e.g. "$1,450.00" or "+$3,200.00". */
export const AMOUNT_CELL_PATTERN = /^[+-]?\$([\d,]+(?:\.\d+)?)$/;

/** Month names as Monarch abbreviates them, January first. */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A month and day in a row's status text, e.g. "Paid Sep 14" or "Sep 30". */
export const STATUS_DATE_PATTERN = new RegExp(`\\b(${MONTH_NAMES.join('|')}) (\\d{1,2})\\b`);
