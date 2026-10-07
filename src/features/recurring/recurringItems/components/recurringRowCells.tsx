import { type ReactNode, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { CENT_TOLERANCE } from '../../../../common/money';
import type { RecurringView } from '../../../../monarch/pages/recurringV2/models/recurringView';
import { RecurringV2Page } from '../../../../monarch/pages/recurringV2/recurringV2Page';
import { Avatar } from '../../../../monarch/ui/components/avatar';
import { Icon } from '../../../../monarch/ui/components/icons';
import { type MenuItem, MoreMenu } from '../../../../monarch/ui/components/menu';
import { Skeleton, SkeletonText } from '../../../../monarch/ui/components/skeleton';
import { Sparkline, type SparkPoint } from '../../../../monarch/ui/components/sparkline';
import { Tooltip } from '../../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { WingspanMark } from '../../../wingspanMark';
import { ESTIMATED_MINIMUM_RULE, missesMinimum, type PlannedCardPayment, paysInFull } from '../../statements/models/cardPaymentPlans';
import type { RecurringLine } from '../models/recurringLine';
import type { RecurringItemServices } from '../services/recurringItemServices';

const RING_CIRCUMFERENCE = 37.7;
const COLUMNS_NEEDING_DATA = new Set(['status', 'history', 'amount', 'last date', 'next date']);

/** What one of Wingspan's rows shows in Monarch's columns. */
export interface RowCellsProps {
	line: RecurringLine;
	view: RecurringView;
	columnLabels: string[];
	history: SparkPoint[];
	accountName: string;
	menuItems: MenuItem[];
	menuClassName?: string;
	isLoading: boolean;
	/** Monarch's transactions didn't load, so whether anything was paid isn't known. */
	couldNotCheckPayments: boolean;
	/** For an unpaid card payment: what checking can pay on its due date. */
	plannedPayment?: PlannedCardPayment;
	services: RecurringItemServices;
}

/** A row's cells, and the row element on the page they render into. */
export interface RowEntry {
	rowEl: HTMLElement;
	cellsProps: RowCellsProps;
}

export interface RecurringRowsProps {
	entries: RowEntry[];
}

interface ProgressRingProps {
	paidCount: number;
	totalCount: number;
}

interface CellTextProps {
	children: string;
	tone?: string;
}

interface StatusCellProps {
	line: RecurringLine;
	services: RecurringItemServices;
}

interface ColumnCellProps {
	columnLabel: string;
	line: RecurringLine;
	history: SparkPoint[];
	accountName: string;
	plannedPayment?: PlannedCardPayment;
	services: RecurringItemServices;
}

interface LoadingCellProps {
	columnLabel: string;
}

/** Portals each row's cells into its own row element, all from one React root. */
export function RecurringRows({ entries }: RecurringRowsProps) {
	return <>{entries.map(({ rowEl, cellsProps }) => createPortal(<RowCells {...cellsProps} rowEl={rowEl} />, rowEl, cellsProps.line.key))}</>;
}

/** The row's name is the item's; screen readers read the rest of the row as its description. */
function RowCells({
	rowEl,
	line,
	view,
	columnLabels,
	history,
	accountName,
	menuItems,
	menuClassName,
	isLoading,
	couldNotCheckPayments,
	plannedPayment,
	services
}: RowCellsProps & { rowEl: HTMLElement }) {
	const idPrefix = useId();
	const subtitleId = `${idPrefix}subtitle`;
	const cellId = (columnLabel: string) => `${idPrefix}${columnLabel.toLowerCase().replaceAll(/\W/g, '')}`;
	const describedBy = [subtitleId, ...columnLabels.map(cellId)].join(' ');
	useLayoutEffect(() => {
		rowEl.setAttribute('aria-describedby', describedBy);
		return () => rowEl.removeAttribute('aria-describedby');
	}, [rowEl, describedBy]);

	return (
		<>
			<div className="flex min-w-0 items-center gap-sm">
				<div className="size-6 shrink-0" />
				<Avatar source={line.item} />
				<div className="flex min-w-0 flex-col">
					<span className="flex min-w-0 items-center gap-2xs">
						<span className="text-base font-book text-content-primary block truncate">{line.item.name}</span>
						<WingspanMark />
					</span>
					<span id={subtitleId} className="text-sm font-book text-content-secondary truncate">
						{subtitleFor(line, view, services)}
					</span>
				</div>
			</div>
			{columnLabels.map(columnLabel => {
				if (isLoading && COLUMNS_NEEDING_DATA.has(columnLabel.toLowerCase())) return <LoadingCell key={columnLabel} columnLabel={columnLabel} />;
				if (couldNotCheckPayments && columnLabel.toLowerCase() === 'status') {
					return (
						<div key={columnLabel} id={cellId(columnLabel)}>
							<CellText tone="font-book text-content-secondary">Couldn't check payments</CellText>
						</div>
					);
				}
				return (
					<div key={columnLabel} id={cellId(columnLabel)} className="contents">
						<ColumnCell columnLabel={columnLabel} line={line} history={history} accountName={accountName} plannedPayment={plannedPayment} services={services} />
					</div>
				);
			})}
			<div data-external-id="recurring-section-row-menu" {...{ [RecurringV2Page.rowMenuAttribute]: '' }}>
				<MoreMenu items={menuItems} triggerClassName={menuClassName} label={`More options for ${line.item.name}`} />
			</div>
		</>
	);
}

function subtitleFor(line: RecurringLine, view: RecurringView, { recurrence, dueLabels }: RecurringItemServices): string {
	const schedule = recurrence.fromRecurrence(line.item.recurrence);
	const frequency = recurrence.describe(schedule);

	if (view === 'all') return recurrence.isPlainMonthly(schedule) && schedule.monthDay ? `${frequency} · ${dueLabels.dueOnDay(schedule.monthDay)}` : frequency;
	// Carried-over debts show their date in the status; the subtitle only covers the month shown.
	const monthOccurrences = line.occurrences.filter(occurrence => !occurrence.carried);
	const [onlyOccurrence] = monthOccurrences;
	if (monthOccurrences.length > 1) {
		const nextUnpaid = monthOccurrences.find(occurrence => !occurrence.paid);
		return `${frequency} · ${nextUnpaid ? dueLabels.next(nextUnpaid.dueDate) : dueLabels.allPaid}`;
	}
	return `${frequency} · ${dueLabels.due(onlyOccurrence?.dueDate ?? line.dueDate)}`;
}

function ProgressRing({ paidCount, totalCount }: ProgressRingProps) {
	return (
		<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true" className="shrink-0 text-content-success">
			<circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
			<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${(RING_CIRCUMFERENCE * paidCount) / totalCount} ${RING_CIRCUMFERENCE}`} transform="rotate(-90 8 8)" />
		</svg>
	);
}

function PaidMark() {
	return (
		<span className="flex size-3.75 shrink-0 items-center justify-center rounded-full bg-background-success text-content-success">
			<Icon shape="check" size={9} className="shrink-0" />
		</span>
	);
}

function CellText({ children, tone = 'font-medium text-content-primary' }: CellTextProps) {
	return <span className={`text-base ${tone} min-w-0 truncate`}>{children}</span>;
}

function StatusCell({ line, services: { formatter } }: StatusCellProps) {
	const occurrenceCount = line.occurrences.length;
	const paidCount = line.occurrences.filter(occurrence => occurrence.paid).length;
	let content: ReactNode;

	if (line.overdue) {
		const firstOverdue = line.occurrences.find(occurrence => occurrence.overdue);
		const dueText = firstOverdue ? formatter.shortDate(firstOverdue.dueDate) : '';
		const overdueCount = line.occurrences.filter(occurrence => occurrence.overdue).length;
		let overdueText = `Overdue ${dueText}`;
		if (overdueCount > 1) overdueText = `${overdueCount} owed since ${dueText}`;
		else if (firstOverdue?.carried) overdueText = `Owed since ${dueText}`;
		content = (
			<>
				<Icon shape="alert" size={14} className="shrink-0 text-content-danger" />
				<CellText tone="font-medium text-content-danger">{overdueText}</CellText>
			</>
		);
	} else if (occurrenceCount > 1) {
		content = (
			<>
				{line.paid ? <PaidMark /> : <ProgressRing paidCount={paidCount} totalCount={occurrenceCount} />}
				<CellText>{`${paidCount} of ${occurrenceCount} paid`}</CellText>
			</>
		);
	} else if (line.paid) {
		const matchedTransaction = line.occurrences[0]?.matchedTransaction;
		let paidText = 'Nothing owed';
		if (matchedTransaction) paidText = `Paid ${formatter.shortDate(matchedTransaction.date)}`;
		else if (line.amount > 0) paidText = 'Paid';
		content = (
			<>
				<PaidMark />
				<CellText>{paidText}</CellText>
			</>
		);
	} else {
		content = (
			<>
				<Icon shape="calendar" size={14} className="shrink-0 text-content-secondary" />
				<CellText tone="font-book text-content-primary">{formatter.shortDate(line.dueDate)}</CellText>
			</>
		);
	}

	return (
		<div data-external-id="status-copy-text" className="flex min-w-0 items-center gap-1.5">
			{content}
		</div>
	);
}

/** When the statement is smaller than the card's balance, show the statement amount so "in full" isn't mistaken for the whole balance. */
function CanPayNote({ plannedPayment, shownAmount, formatter }: { plannedPayment: PlannedCardPayment; shownAmount: number; formatter: Formatter }) {
	const { amount, owed, minimum, minimumIsEstimated } = plannedPayment;
	const isStatementOnly = shownAmount - owed > CENT_TOLERANCE;
	const isInFull = paysInFull(plannedPayment);
	const isShortOfMinimum = missesMinimum(plannedPayment);
	const minimumText = minimum === null ? '' : `${minimumIsEstimated ? '~' : ''}${formatter.money(minimum)} ${minimumIsEstimated ? 'est. ' : ''}min`;
	let tone: string;
	let text: string;
	if (isInFull) {
		tone = 'text-content-success';
		text = isStatementOnly ? `Can pay the ${formatter.money(owed)} statement` : 'Can pay in full';
	} else if (isShortOfMinimum) {
		tone = 'text-content-danger';
		text = `Can pay ${formatter.money(amount)} of ${minimumText}`;
	} else {
		tone = 'text-content-warning';
		text = isStatementOnly ? `Can pay ${formatter.money(amount)} of the ${formatter.money(owed)} statement` : `Can pay ${formatter.money(amount)}`;
	}
	const note = <div className={`mt-px text-xs font-medium ${tone}`}>{text}</div>;
	if (isInFull || !minimumIsEstimated || minimum === null) return note;

	const explanation = `The minimum is estimated: this card's account in Monarch has no minimum payment, so it's estimated as ${ESTIMATED_MINIMUM_RULE}. Add the minimum in the account's details in Monarch to use the exact figure. The plan covers ${minimumText} before paying extra.`;
	return (
		<Tooltip label={explanation}>
			<div className={`mt-px text-xs font-medium ${tone}`} role="note" aria-label={`${text}. ${explanation}`}>
				{text}
			</div>
		</Tooltip>
	);
}

function LoadingCell({ columnLabel }: LoadingCellProps) {
	switch (columnLabel.toLowerCase()) {
		case 'history':
			return (
				<div className="justify-self-center">
					<Skeleton style={{ width: 96, height: 24 }} />
				</div>
			);
		case 'amount':
			return (
				<div className="text-right">
					<SkeletonText className="text-base" style={{ width: 64 }} />
				</div>
			);
		default:
			return (
				<div>
					<SkeletonText className="text-base" style={{ width: 88 }} />
				</div>
			);
	}
}

function ColumnCell({ columnLabel, line, history, accountName, plannedPayment, services }: ColumnCellProps) {
	const { formatter } = services;

	switch (columnLabel.toLowerCase()) {
		case 'status':
			return <StatusCell line={line} services={services} />;
		case 'history':
			return <Sparkline points={history} formatter={formatter} />;
		case 'amount': {
			const itemKind = services.kinds.of(line.item);
			const unknownNote = itemKind.linkedAccountId(line.item) === undefined ? 'Set a typical payment' : 'No balance from Monarch';
			const amountNote = line.amountUnknown && !line.paid ? unknownNote : itemKind.amountNote(line.item, line.paid);
			let note: ReactNode = null;
			if (plannedPayment) note = <CanPayNote plannedPayment={plannedPayment} shownAmount={line.amount} formatter={formatter} />;
			else if (amountNote) note = <div className="mt-px text-xs font-medium text-content-secondary">{amountNote}</div>;
			return (
				<div data-external-id="recurring-amount-with-delta" className="text-right">
					<span className="text-base font-medium text-content-primary">{line.amountUnknown && !line.paid ? 'Unknown' : formatter.money(line.amount)}</span>
					{note}
				</div>
			);
		}
		case 'type':
			return (
				<div>
					<CellText tone="font-book text-content-primary">{services.kinds.of(line.item).typeColumnLabel}</CellText>
				</div>
			);
		case 'account':
			return (
				<div>
					<CellText tone="font-book text-content-primary">{accountName}</CellText>
				</div>
			);
		case 'last date':
			return (
				<div className="flex min-w-0 items-center gap-1.5">
					{line.lastPaidDate ? (
						<>
							<PaidMark />
							<CellText>{`Paid ${formatter.nearDate(line.lastPaidDate)}`}</CellText>
						</>
					) : (
						<CellText tone="font-book text-content-secondary">–</CellText>
					)}
				</div>
			);
		case 'next date':
			return (
				<div className="flex min-w-0 items-center gap-1.5">
					{line.nextDueDate ? (
						<>
							<Icon shape="calendar" size={14} className="shrink-0 text-content-secondary" />
							<CellText tone="font-book text-content-primary">{formatter.nearDate(line.nextDueDate)}</CellText>
						</>
					) : null}
				</div>
			);
		default:
			return <div />;
	}
}
