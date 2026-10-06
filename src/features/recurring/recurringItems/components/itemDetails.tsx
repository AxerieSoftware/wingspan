import { type ReactNode, useState } from 'react';
import type { BalancesByAccountId } from '../../../../data/models/balancesByAccountId';
import { Avatar } from '../../../../monarch/ui/components/avatar';
import { DayPicker } from '../../../../monarch/ui/components/dayPicker';
import { Field } from '../../../../monarch/ui/components/field';
import { Icon } from '../../../../monarch/ui/components/icons';
import { TextInput } from '../../../../monarch/ui/components/input';
import { LogoWash } from '../../../../monarch/ui/components/logoWash';
import { type MenuItem, MoreMenu } from '../../../../monarch/ui/components/menu';
import { MetaRow } from '../../../../monarch/ui/components/metaRow';
import { Skeleton, SkeletonText } from '../../../../monarch/ui/components/skeleton';
import { describeSparkPoint } from '../../../../monarch/ui/components/sparkline';
import { Tooltip } from '../../../../monarch/ui/components/tooltip';
import { savedLogoUrl } from '../../../../monarch/ui/savedLogoUrl';
import { PANEL_ICON_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import type { HistoryPoint } from '../models/historyPoint';
import type { RecurringItem } from '../models/recurringItem';
import type { RecurringItemServices } from '../services/recurringItemServices';

const CHART_HEIGHT = 72;
const CHART_LABEL_CLEARANCE = 14;
const AVERAGE_LABEL_MIN_TOP = 5;
const MUTED_TEXT_CLASS_NAME = 'font-book text-content-secondary italic';

/** `historyPoints` are the item's due dates from the ledger. `onSave` saves a change made in the panel, as to its name or due day. */
export interface ItemDetailsProps {
	item: RecurringItem;
	historyPoints: HistoryPoint[];
	trackingSince: string;
	accountNames: ReadonlyMap<string, string>;
	owedByAccountId: BalancesByAccountId;
	isLoading: boolean;
	couldNotCheckPayments: boolean;
	menuItems: MenuItem[];
	services: RecurringItemServices;
	onSave(item: RecurringItem): void;
	onClose(): void;
}

interface AmountHistoryProps {
	points: HistoryPoint[];
	services: RecurringItemServices;
}

interface TransactionListRowProps {
	date: string;
	dateClassName: string;
	amount: string;
	amountClassName: string;
	externalId?: string;
	children: ReactNode;
}

interface TransactionsProps {
	points: HistoryPoint[];
	trackingSince: string;
	/** Unpaid months from this one on are still owed, since the list carries them over. */
	owedFromMonth: string;
	/** Null once a schedule has run out. */
	nextDueDate: string | null;
	nextAmount: number;
	services: RecurringItemServices;
}

interface NameFieldProps {
	item: RecurringItem;
	onSave(name: string): void;
}

/** The panel for an open item: its details, payment history chart and transactions. */
export function ItemDetails({ item, historyPoints, trackingSince, accountNames, owedByAccountId, isLoading, couldNotCheckPayments, menuItems, services, onSave, onClose }: ItemDetailsProps) {
	const { formatter, recurrence, payments, kinds } = services;
	const itemKind = kinds.of(item);
	const schedule = recurrence.fromRecurrence(item.recurrence);
	// The first due date after the history, skipping any already paid early.
	const lastPoint = historyPoints.at(-1);
	const nextDueDate =
		historyPoints.find(point => point.upcoming)?.dueDate ??
		(lastPoint && lastPoint.dueDate > services.calendar.today() ? recurrence.nextDue(item.recurrence, lastPoint.dueDate) : recurrence.nextDueAfterToday(item.recurrence));
	const nextAmount = itemKind.occurrenceAmount(item, null, owedByAccountId);
	const paidFromAccountId = item.matchRule?.accountId;
	const setMonthDay = (monthDay: number) => onSave({ ...item, recurrence: recurrence.toRecurrence({ ...schedule, monthDay, twiceMonthlyDays: undefined }) });

	return (
		<div role="region" aria-label={`${item.name} details`} className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-default bg-background-primary shadow-card">
			<LogoWash logoUrl={savedLogoUrl(item.icon?.kind === 'logo' ? item.icon.url : undefined)} />
			<div className="relative flex min-h-0 flex-auto flex-col overflow-y-auto">
				<div className="flex h-15 shrink-0 items-center justify-between px-default">
					<WingspanMark />
					<div className="flex shrink-0 items-center gap-xs">
						<MoreMenu items={menuItems} triggerClassName={PANEL_ICON_BUTTON_CLASS_NAME} />
						<button type="button" className={PANEL_ICON_BUTTON_CLASS_NAME} aria-label="Close detail panel" title="Close detail panel" onClick={onClose}>
							<Icon shape="cross" size={16} />
						</button>
					</div>
				</div>
				<div className="flex-auto rounded-b-default px-default pt-default">
					<div className="mb-2xl flex flex-col gap-md">
						<NameField key={`${item.id}|${item.name}`} item={item} onSave={name => onSave({ ...item, name })} />
						<div className="divide-y divide-divider-primary">
							<MetaRow label="Type">{itemKind.label}</MetaRow>
							<MetaRow label="Frequency">{recurrence.describe(schedule)}</MetaRow>
							{recurrence.isPlainMonthly(schedule) ? (
								<MetaRow label="Due day">
									<DayPicker inline label="Due day" value={schedule.monthDay} formatter={formatter} onChange={monthDay => monthDay && setMonthDay(monthDay)} />
								</MetaRow>
							) : (
								<MetaRow label="Next due">{nextDueDate ? formatter.longDate(nextDueDate) : 'None'}</MetaRow>
							)}
							{itemKind.detailRows(item, accountNames).map(detailRow => (
								<MetaRow key={detailRow.label} label={detailRow.label}>
									{detailRow.value}
								</MetaRow>
							))}
							{paidFromAccountId ? <MetaRow label="Paid from">{accountNames.get(paidFromAccountId) ?? 'Linked account'}</MetaRow> : null}
							{item.notes ? <MetaRow label="Notes">{item.notes}</MetaRow> : null}
						</div>
					</div>
					{isLoading ? (
						<LoadingHistory />
					) : couldNotCheckPayments ? (
						<p className={`m-0 text-sm ${MUTED_TEXT_CLASS_NAME}`}>Couldn't check payments: Monarch's transactions didn't load.</p>
					) : (
						<>
							<div className="mb-2xl">
								<AmountHistory points={payments.monthlyHistory(historyPoints, trackingSince)} services={services} />
							</div>
							<div className="-mx-default my-lg border-t border-t-divider-primary" />
							<Transactions
								points={historyPoints}
								trackingSince={trackingSince}
								owedFromMonth={services.calendar.addMonths(services.calendar.currentMonth(), -itemKind.unpaidCarryMonths)}
								nextDueDate={nextDueDate}
								nextAmount={nextAmount}
								services={services}
							/>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function AmountHistory({ points, services: { formatter } }: AmountHistoryProps) {
	const knownAmounts = points.map(point => point.amount).filter((amount): amount is number => amount !== null);
	const largestAmount = Math.max(1, ...knownAmounts);
	const averageAmount = knownAmounts.length ? knownAmounts.reduce((total, amount) => total + amount, 0) / knownAmounts.length : 0;
	const smallestAmount = knownAmounts.length ? Math.min(...knownAmounts) : 0;
	const latestPaidIndex = points.findLastIndex(point => point.amount !== null);
	const averageTop = CHART_HEIGHT - (averageAmount / largestAmount) * CHART_HEIGHT;
	const axisLabelClassName = 'absolute left-0 text-2xs leading-none whitespace-nowrap text-chart-label';
	const firstPoint = points[0];
	const lastPoint = points.at(-1);

	return (
		<section data-external-id="amount-history-chart">
			<span className="text-base font-medium text-content-primary">Amount history</span>
			<div className="mt-sm flex gap-xs">
				<div className="min-w-0 flex-1">
					<div
						role="img"
						aria-label={points.map(point => describeSparkPoint(point, formatter)).join('; ')}
						className="relative flex items-end border-b border-chart-axis"
						style={{ height: CHART_HEIGHT, gap: 4 }}
					>
						{points.map((point, index) => {
							const barValue = point.amount ?? (point.paid ? averageAmount : 0);
							const barHeight = barValue ? Math.max(3, (barValue / largestAmount) * CHART_HEIGHT) : 0;
							const barTone =
								index === latestPaidIndex ? 'bg-background-brand group-hover/historybar:bg-background-brand-hover' : 'bg-chart-event-border-gray group-hover/historybar:bg-content-secondary';
							return (
								<Tooltip key={point.dueDate} label={describeSparkPoint(point, formatter)} delay={0}>
									<div className="h-full min-w-0 flex-1">
										<div className="group/historybar relative size-full cursor-default">
											{barHeight ? <div className={`absolute bottom-0 w-full ${barTone}`} style={{ height: barHeight, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} /> : null}
										</div>
									</div>
								</Tooltip>
							);
						})}
						{knownAmounts.length ? (
							<div
								className="pointer-events-none absolute inset-x-0 text-divider-tertiary"
								style={{ top: averageTop, height: 1, backgroundImage: 'repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 8px)' }}
							/>
						) : null}
					</div>
					<div className="mt-2xs flex justify-between">
						<span className="text-2xs text-chart-label">{firstPoint ? formatter.chartMonth(firstPoint.month) : ''}</span>
						<span className="text-2xs text-chart-label">{lastPoint ? formatter.chartMonth(lastPoint.month) : ''}</span>
					</div>
				</div>
				<div className="relative w-10 shrink-0" style={{ height: CHART_HEIGHT }}>
					{knownAmounts.length ? (
						<>
							{averageTop > CHART_LABEL_CLEARANCE ? <span className={`${axisLabelClassName} top-0`}>{formatter.wholeMoney(largestAmount)}</span> : null}
							<span className={`${axisLabelClassName} -translate-y-1/2`} style={{ top: Math.max(AVERAGE_LABEL_MIN_TOP, averageTop) }}>{`avg ${formatter.wholeMoney(averageAmount)}`}</span>
							{CHART_HEIGHT - averageTop > CHART_LABEL_CLEARANCE && smallestAmount < largestAmount ? (
								<span className={`${axisLabelClassName} bottom-0`}>{formatter.wholeMoney(smallestAmount)}</span>
							) : null}
						</>
					) : null}
				</div>
			</div>
		</section>
	);
}

function TransactionListRow({ date, dateClassName, amount, amountClassName, externalId, children }: TransactionListRowProps) {
	return (
		<div data-external-id={externalId} style={{ minHeight: 50 }} className="-mx-default flex items-center justify-between gap-2.5 px-default py-2xs">
			<div className="flex min-w-0 flex-1 items-center gap-sm">
				<span className={`text-sm w-[6.5rem] shrink-0 ${dateClassName}`}>{date}</span>
				<div className="flex min-w-0 items-center gap-1 pl-1">{children}</div>
			</div>
			<div className="flex shrink-0 items-center gap-sm">
				<span className={`text-sm ${amountClassName}`}>{amount}</span>
			</div>
		</div>
	);
}

function Transactions({ points, trackingSince, owedFromMonth, nextDueDate, nextAmount, services: { formatter } }: TransactionsProps) {
	return (
		<div data-external-id="recurring-stream-transaction-list" className="-mx-default px-default">
			<span className="text-base font-medium text-content-primary">Transactions</span>
			<div className="-mx-default mt-sm border-t border-t-divider-primary" />
			{nextDueDate ? (
				<TransactionListRow
					externalId="upcoming-transaction-row"
					date={formatter.longDate(nextDueDate)}
					dateClassName={MUTED_TEXT_CLASS_NAME}
					amount={formatter.money(nextAmount)}
					amountClassName={MUTED_TEXT_CLASS_NAME}
				>
					<Icon shape="calendar" size={14} className="shrink-0 text-content-secondary" />
					<span className={`text-sm ${MUTED_TEXT_CLASS_NAME}`}>Next</span>
				</TransactionListRow>
			) : null}
			{[...points].reverse().map(point => {
				if (point.upcoming) return null;

				if (point.paid) {
					const paidTo = point.transaction ? point.transaction.merchantName || point.transaction.description : 'Nothing owed';
					return (
						<TransactionListRow
							key={point.dueDate}
							externalId="recurring-stream-transaction-row"
							date={formatter.longDate(point.paidDate ?? point.dueDate)}
							dateClassName="font-medium text-content-primary"
							amount={point.amount !== null ? formatter.money(point.amount) : '–'}
							amountClassName="font-medium text-content-primary"
						>
							<span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-background-success text-content-success">
								<Icon shape="check" size={9} className="shrink-0" />
							</span>
							<span className="min-w-0 truncate text-sm font-book text-content-secondary" title={point.transaction?.description ?? paidTo}>
								{paidTo}
							</span>
						</TransactionListRow>
					);
				}

				if (point.month < trackingSince) return null;
				// Same as the row: only carried-over months are owed; earlier ones just had no payment found.
				if (point.month < owedFromMonth) {
					return (
						<TransactionListRow key={point.dueDate} date={formatter.longDate(point.dueDate)} dateClassName={MUTED_TEXT_CLASS_NAME} amount="" amountClassName={MUTED_TEXT_CLASS_NAME}>
							<span className="size-4 shrink-0" />
							<span className={`text-sm ${MUTED_TEXT_CLASS_NAME}`}>No payment found</span>
						</TransactionListRow>
					);
				}
				return (
					<TransactionListRow key={point.dueDate} date={formatter.longDate(point.dueDate)} dateClassName="font-medium text-content-brand" amount="" amountClassName="font-book text-content-secondary">
						<span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-background-brand-subtle text-content-brand">
							<Icon shape="mark" size={10} />
						</span>
						<span className="text-sm font-medium text-content-brand">Owed</span>
					</TransactionListRow>
				);
			})}
		</div>
	);
}

function LoadingHistory() {
	return (
		<>
			<div className="mb-2xl">
				<span className="text-base font-medium text-content-primary">Amount history</span>
				<Skeleton className="mt-sm w-full" style={{ height: CHART_HEIGHT }} />
			</div>
			<div className="-mx-default my-lg border-t border-t-divider-primary" />
			<span className="text-base font-medium text-content-primary">Transactions</span>
			<div className="-mx-default mt-sm border-t border-t-divider-primary" />
			{[0, 1, 2].map(placeholderIndex => (
				<div key={placeholderIndex} style={{ minHeight: 50 }} className="flex items-center justify-between gap-2.5 py-2xs">
					<SkeletonText className="text-sm" style={{ width: 96 }} />
					<SkeletonText className="text-sm" style={{ width: 120 }} />
					<SkeletonText className="text-sm" style={{ width: 56 }} />
				</div>
			))}
		</>
	);
}

function NameField({ item, onSave }: NameFieldProps) {
	const [name, setName] = useState(item.name);

	const commitName = () => {
		const trimmedName = name.trim();
		if (trimmedName && trimmedName !== item.name) onSave(trimmedName);
		else setName(item.name);
	};

	return (
		<Field label="Name">
			<div className="flex items-start gap-2.5">
				<Avatar source={item} size={10} />
				<TextInput value={name} onChange={setName} onBlur={commitName} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} />
			</div>
		</Field>
	);
}
