import { type ReactNode, useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Calendar } from '../../../../common/calendar';
import { CENT_TOLERANCE } from '../../../../common/money';
import type { RecurringView } from '../../../../monarch/pages/recurringV2/models/recurringView';
import { RecurringV2Page } from '../../../../monarch/pages/recurringV2/recurringV2Page';
import { Avatar } from '../../../../monarch/ui/components/avatar';
import { ChevronIcon, Icon } from '../../../../monarch/ui/components/icons';
import { type MenuItem, MoreMenu } from '../../../../monarch/ui/components/menu';
import { Skeleton, SkeletonText } from '../../../../monarch/ui/components/skeleton';
import { Sparkline, type SparkPoint } from '../../../../monarch/ui/components/sparkline';
import { Tooltip } from '../../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { iconButtonStyles } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import { ESTIMATED_MINIMUM_RULE, missesMinimum, type PlannedCardPayment, paysInFull } from '../../statements/models/cardPaymentPlans';
import { type MoneyFlow, PAID_WORDS } from '../kinds/recurringItemKind';
import type { Occurrence } from '../models/occurrence';
import type { RecurringLine } from '../models/recurringLine';
import type { RecurringItemServices } from '../services/recurringItemServices';

const RING_CIRCUMFERENCE = 37.7;
const CHEVRON_STYLE = { width: 12, height: 12 };
/** Spans the row and lines its cells up with the row's own columns. */
const OCCURRENCE_ROW_STYLE = { gridColumn: '1 / -1', gridTemplateColumns: 'subgrid' };
/** How long a payment can take to post after its due date before the bill shows as overdue. */
const LATE_POSTING_DAYS = 3;
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
	const [isExpanded, setIsExpanded] = useState(false);
	// In a month, an item due more than once lists each due date under it, like Monarch's own items.
	const canExpand = view === 'month' && line.occurrences.length > 1 && !isLoading;
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
				<div className="size-6 shrink-0" {...{ [RecurringV2Page.rowControlAttribute]: '' }}>
					{canExpand ? (
						<button
							type="button"
							className={iconButtonStyles({ variant: 'ghost', size: '3xs' })}
							aria-label={`${isExpanded ? 'Hide' : 'Show'} each payment for ${line.item.name}`}
							aria-expanded={isExpanded}
							onClick={() => setIsExpanded(!isExpanded)}
						>
							<span className={`inline-flex shrink-0 transition-transform${isExpanded ? '' : ' -rotate-90'}`} style={CHEVRON_STYLE}>
								<ChevronIcon />
							</span>
						</button>
					) : null}
				</div>
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
			<div data-external-id="recurring-section-row-menu" {...{ [RecurringV2Page.rowControlAttribute]: '' }}>
				<MoreMenu items={menuItems} triggerClassName={menuClassName} label={`More options for ${line.item.name}`} />
			</div>
			{canExpand && isExpanded ? line.occurrences.map(occurrence => <OccurrenceRow key={occurrence.key} occurrence={occurrence} columnLabels={columnLabels} services={services} />) : null}
		</>
	);
}

/** One due date under an expanded row, in Monarch's layout for an item's payments: the date, its status and its amount. */
function OccurrenceRow({ occurrence, columnLabels, services: { formatter, kinds, calendar } }: { occurrence: Occurrence; columnLabels: string[]; services: RecurringItemServices }) {
	const moneyFlow = kinds.of(occurrence.item).moneyFlow;
	const cellFor = (columnLabel: string) => {
		switch (columnLabel.toLowerCase()) {
			case 'status':
				return (
					<div key={columnLabel} className="flex min-w-0 items-center gap-1.5">
						<OccurrenceStatus occurrence={occurrence} paidWord={PAID_WORDS[moneyFlow]} formatter={formatter} calendar={calendar} />
					</div>
				);
			case 'amount':
				return (
					<div key={columnLabel} className="text-right">
						<SignedAmount amount={occurrence.amount} moneyFlow={moneyFlow} size="text-sm" formatter={formatter} />
					</div>
				);
			default:
				return <div key={columnLabel} />;
		}
	};

	return (
		<div className="grid items-center py-2.5" style={OCCURRENCE_ROW_STYLE}>
			<div className="flex min-w-0 items-center gap-sm">
				<div className="size-6 shrink-0" />
				<div className="size-8 shrink-0" />
				<span className="text-sm font-book text-content-primary min-w-0 truncate">{formatter.weekdayDate(occurrence.dueDate)}</span>
			</div>
			{columnLabels.map(cellFor)}
			<div />
		</div>
	);
}

function OccurrenceStatus({ occurrence, paidWord, formatter, calendar }: { occurrence: Occurrence; paidWord: string; formatter: Formatter; calendar: Calendar }) {
	const textClassName = 'text-sm font-book min-w-0 truncate';
	if (occurrence.paid) {
		const paidDate = occurrence.matchedTransaction?.date;
		return (
			<>
				<PaidMark />
				<span className={`${textClassName} text-content-primary`}>{paidDate ? `${paidWord} ${formatter.shortDate(paidDate)}` : paidWord}</span>
			</>
		);
	}
	if (isWithinPostingGrace(occurrence, calendar)) return <span className={`${textClassName} text-content-primary`}>{`Not paid yet · due ${formatter.shortDate(occurrence.dueDate)}`}</span>;
	if (occurrence.overdue) return <span className={`${textClassName} text-content-danger`}>{`Overdue ${formatter.shortDate(occurrence.dueDate)}`}</span>;
	return <span className={`${textClassName} text-content-primary`}>{formatter.shortDate(occurrence.dueDate)}</span>;
}

/** Income in green with a plus sign, as in Monarch's amounts. */
function SignedAmount({ amount, moneyFlow, size, formatter }: { amount: number; moneyFlow: MoneyFlow; size: 'text-sm' | 'text-base'; formatter: Formatter }) {
	const isInflow = moneyFlow === 'inflow';
	return <span className={`${size} font-medium ${isInflow ? 'text-content-success' : 'text-content-primary'}`}>{`${isInflow ? '+' : ''}${formatter.money(amount)}`}</span>;
}

/** A payment often posts a few days late, so a due date just past isn't flagged as overdue yet. */
function isWithinPostingGrace(occurrence: Occurrence, calendar: Calendar): boolean {
	return occurrence.overdue && !occurrence.carried && occurrence.dueDate >= calendar.addDays(calendar.today(), -LATE_POSTING_DAYS);
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

function StatusCell({ line, services: { formatter, kinds, calendar } }: StatusCellProps) {
	const paidWord = PAID_WORDS[kinds.of(line.item).moneyFlow];
	const occurrenceCount = line.occurrences.length;
	const paidCount = line.occurrences.filter(occurrence => occurrence.paid).length;
	let content: ReactNode;

	const firstOverdue = line.occurrences.find(occurrence => occurrence.overdue);
	const overdueCount = line.occurrences.filter(occurrence => occurrence.overdue).length;
	if (firstOverdue && overdueCount === 1 && isWithinPostingGrace(firstOverdue, calendar)) {
		content = <CellText tone="font-book text-content-primary">{`Not paid yet · due ${formatter.shortDate(firstOverdue.dueDate)}`}</CellText>;
	} else if (line.overdue) {
		const dueText = firstOverdue ? formatter.shortDate(firstOverdue.dueDate) : '';
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
				<CellText>{`${paidCount} of ${occurrenceCount} ${paidWord.toLowerCase()}`}</CellText>
			</>
		);
	} else if (line.paid) {
		const matchedTransaction = line.occurrences[0]?.matchedTransaction;
		let paidText = 'Nothing owed';
		if (matchedTransaction) paidText = `${paidWord} ${formatter.shortDate(matchedTransaction.date)}`;
		else if (line.amount > 0) paidText = paidWord;
		content = (
			<>
				<PaidMark />
				<CellText>{paidText}</CellText>
			</>
		);
	} else if (line.dueDate < calendar.today()) {
		// Only income gets here: a bill past its due date is overdue.
		content = <CellText tone="font-book text-content-secondary">{`Not received ${formatter.shortDate(line.dueDate)}`}</CellText>;
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

/** What checking can pay toward the statement shown above it. Neutral on an overdue statement, so it doesn't read as all clear. */
function CanPayNote({ plannedPayment, isOverdue, formatter }: { plannedPayment: PlannedCardPayment; isOverdue: boolean; formatter: Formatter }) {
	const { amount, minimum, minimumIsEstimated } = plannedPayment;
	const isInFull = paysInFull(plannedPayment);
	const isShortOfMinimum = missesMinimum(plannedPayment);
	const minimumText = minimum === null ? '' : `${minimumIsEstimated ? '~' : ''}${formatter.money(minimum)} ${minimumIsEstimated ? 'est. ' : ''}min`;
	let tone: string;
	let text: string;
	if (isInFull) {
		tone = isOverdue ? 'text-content-primary' : 'text-content-success';
		text = isOverdue ? 'Checking can pay it in full today' : 'Can pay in full';
	} else if (isShortOfMinimum) {
		tone = 'text-content-danger';
		text = `Can pay ${formatter.money(amount)} of ${minimumText}`;
	} else {
		tone = 'text-content-warning';
		text = `Can pay ${formatter.money(amount)}`;
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
			// A statement smaller than the card's balance leads with the statement, since that's what's due.
			const statementOwed = plannedPayment && line.amount - plannedPayment.owed > CENT_TOLERANCE ? plannedPayment.owed : null;
			let note: ReactNode = null;
			if (plannedPayment) note = <CanPayNote plannedPayment={plannedPayment} isOverdue={line.overdue} formatter={formatter} />;
			else if (amountNote) note = <div className="mt-px text-xs font-medium text-content-secondary">{amountNote}</div>;
			return (
				<div data-external-id="recurring-amount-with-delta" className="text-right">
					{line.amountUnknown && !line.paid ? (
						<span className="text-base font-medium text-content-primary">Unknown</span>
					) : (
						<SignedAmount amount={statementOwed ?? line.amount} moneyFlow={itemKind.moneyFlow} size="text-base" formatter={formatter} />
					)}
					{statementOwed !== null ? <div className="mt-px text-xs font-book text-content-secondary">{`Statement · ${formatter.money(line.amount)} balance`}</div> : null}
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
							<CellText>{`${PAID_WORDS[services.kinds.of(line.item).moneyFlow]} ${formatter.nearDate(line.lastPaidDate)}`}</CellText>
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
