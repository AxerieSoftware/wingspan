/** The attributes on the outermost element of each part Wingspan adds to Monarch's pages. */
export const WingspanAttribute = {
	row: 'data-wingspan-row',
	rowDate: 'data-wingspan-date',
	rowMenu: 'data-wingspan-row-menu',
	rowsHost: 'data-wingspan-rows',
	section: 'data-wingspan-section',
	statements: 'data-wingspan-statements',
	statementsCount: 'data-wingspan-statements-count',
	summaryStatements: 'data-wingspan-summary-statements',
	detail: 'data-wingspan-detail',
	detailRow: 'data-wingspan-detail-row',
	due: 'data-wingspan-due',
	entitySwitch: 'data-wingspan-entity-switch',
	entityCount: 'data-wingspan-entity-count',
	entityInactiveLabel: 'data-wingspan-entity-inactive-label',
	entitySummary: 'data-wingspan-entity-summary',
	cashFlowSection: 'data-wingspan-cash-flow-section',
	pageColumn: 'data-wingspan-page-column',
	card: 'data-wingspan-card',
	addChoice: 'data-wingspan-add-choice',
	addFields: 'data-wingspan-add-fields',
	addFooter: 'data-wingspan-add-footer',
	layer: 'data-wingspan-layer',
	toasts: 'data-wingspan-toasts',
	stale: 'data-wingspan-stale',
	retailSync: 'data-wingspan-retail-sync'
} as const;

/** What gets greyed out after an extension update: everything Wingspan shows, except the reload toasts and hidden hosts. */
export const STALE_PARTS = [
	WingspanAttribute.row,
	WingspanAttribute.rowMenu,
	WingspanAttribute.section,
	WingspanAttribute.statements,
	WingspanAttribute.statementsCount,
	WingspanAttribute.summaryStatements,
	WingspanAttribute.detail,
	WingspanAttribute.detailRow,
	WingspanAttribute.due,
	WingspanAttribute.entitySwitch,
	WingspanAttribute.retailSync,
	WingspanAttribute.entityCount,
	WingspanAttribute.entityInactiveLabel,
	WingspanAttribute.entitySummary,
	WingspanAttribute.cashFlowSection,
	WingspanAttribute.pageColumn,
	WingspanAttribute.card,
	WingspanAttribute.addChoice,
	WingspanAttribute.addFields,
	WingspanAttribute.addFooter,
	WingspanAttribute.layer
] as const;

/** Matches any of Wingspan's parts. */
export const WINGSPAN_PARTS_SELECTOR = Object.values(WingspanAttribute)
	.map(attribute => `[${attribute}]`)
	.join(',');
