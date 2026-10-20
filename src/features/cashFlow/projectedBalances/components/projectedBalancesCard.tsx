import type { ReactNode } from 'react';
import type { CashFlowTimeframe } from '../../../../monarch/pages/cashFlow/cashFlowPage';
import { Button } from '../../../../monarch/ui/components/button';
import { EditIcon, InfoIcon, TrendIcon } from '../../../../monarch/ui/components/icons';
import { SkeletonText } from '../../../../monarch/ui/components/skeleton';
import { TooltipButton } from '../../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { LINK_BUTTON_CLASS_NAME } from '../../../../monarch/ui/styles';
import { WingspanMark } from '../../../wingspanMark';
import type { FreeCashSplit } from '../../freeCash/models/freeCashSplit';
import type { Projection } from '../models/projection';
import { UNKNOWN_DUE_DAYS } from '../models/projectionHorizon';
import { ProjectionRange } from '../models/projectionRange';
import { BalanceChart } from './balanceChart';

const TITLE = 'Projected balances';

/** A null projection with checking accounts chosen is still loading; split is null when goals aren't taken out of free cash. */
export interface ProjectedBalancesCardProps {
	projection: Projection | null;
	split: FreeCashSplit | null;
	hasCheckingAccounts: boolean;
	/** How far ahead the chart and its stats run. Free cash always covers the household's safety days or through the next payday, whichever is later. */
	timeframe: CashFlowTimeframe;
	formatter: Formatter;
	onEdit(): void;
	onOpenGoals(): void;
	/** Set when Monarch's or Wingspan's data couldn't load. The card says which one and shows a retry button. */
	unavailable?: { message: string; onRetry(): void };
	/** Monarch's latest data couldn't be loaded, so the card shows older data. */
	stale?: { message: string; onRetry(): void };
}

interface StatProps {
	label: string;
	info: string;
	value: string;
	tone?: string;
	detail?: ReactNode;
}

/** The card under Cash Flow's bar chart: the chart, free cash and its stats, or why there's nothing to show. */
export function ProjectedBalancesCard({ projection, split, hasCheckingAccounts, timeframe, formatter, onEdit, onOpenGoals, unavailable, stale }: ProjectedBalancesCardProps) {
	const range = projection ? new ProjectionRange(projection, timeframe) : null;

	return (
		<section
			role="group"
			data-mds="card"
			aria-label={TITLE}
			className="z-0 flex flex-col gap-sm overflow-hidden rounded-lg border border-border-primary bg-background-primary text-content-primary shadow-none"
		>
			<div className="flex flex-wrap items-center justify-between gap-xs px-default pt-sm pb-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2xs px-xs py-2xs">
					<span data-mds="text" className="min-w-0 truncate text-lg font-medium text-content-primary">
						{TITLE}
					</span>
					<WingspanMark />
					{projection && range ? <NetChange projection={projection} range={range} formatter={formatter} /> : null}
				</div>
				<div className="flex shrink-0 items-center gap-xs">
					{unavailable ? null : (
						<Button leading={<EditIcon />} disabled={!projection && hasCheckingAccounts} onClick={onEdit}>
							Edit cash and cards
						</Button>
					)}
				</div>
			</div>
			{stale && !unavailable ? (
				<div className="flex flex-wrap items-center gap-md px-default pb-sm" role="status">
					<span className="text-sm text-content-warning">{stale.message}</span>
					<Button onClick={stale.onRetry}>Try again</Button>
				</div>
			) : null}
			<CardBody projection={projection} range={range} split={split} hasCheckingAccounts={hasCheckingAccounts} formatter={formatter} onOpenGoals={onOpenGoals} unavailable={unavailable} />
		</section>
	);
}

type CardBodyProps = Pick<ProjectedBalancesCardProps, 'projection' | 'split' | 'hasCheckingAccounts' | 'formatter' | 'onOpenGoals' | 'unavailable'> & { range: ProjectionRange | null };

function CardBody({ projection, range, split, hasCheckingAccounts, formatter, onOpenGoals, unavailable }: CardBodyProps) {
	if (unavailable) {
		return (
			<div className="flex flex-wrap items-center gap-md px-default pb-lg">
				<span className="text-sm text-content-secondary">{unavailable.message}</span>
				<Button onClick={unavailable.onRetry}>Try again</Button>
			</div>
		);
	}
	if (!hasCheckingAccounts) return <span className="px-default pb-lg text-sm text-content-secondary">Choose the checking accounts bills and card payments come out of.</span>;
	if (!projection || !range) {
		return (
			<div className="flex flex-col gap-xs px-default pb-lg">
				<SkeletonText className="text-xl" style={{ width: 240 }} />
				<SkeletonText className="text-sm" style={{ width: '100%' }} />
			</div>
		);
	}

	return (
		<>
			<StatBar projection={projection} range={range} split={split} formatter={formatter} onOpenGoals={onOpenGoals} />
			<div className="flex flex-col p-lg pt-0">
				<BalanceChart days={range.days} events={range.events} cushion={projection.cushion} freeCash={projection.freeCash} freeCashThrough={projection.reversible.endDate} formatter={formatter} />
			</div>
		</>
	);
}

/** Checking at the end of the chart's range minus checking now, shown next to the title like Monarch's own charts. */
function NetChange({ projection, range, formatter }: { projection: Projection; range: ProjectionRange; formatter: Formatter }) {
	const lastDay = range.closingCashDay;
	if (!lastDay) return null;
	const end = range.endDate;

	const change = lastDay.checking - projection.checkingBalance;
	const isUp = change >= 0;
	const amount = `${isUp ? '+' : '-'}${formatter.money(Math.abs(change))}`;
	// A dip from paycheck timing is normal, so it's only an alarm when checking ends below what the household keeps.
	let tone = 'text-content-secondary';
	if (lastDay.checking < projection.cushion) tone = 'text-content-danger';
	else if (isUp) tone = 'text-content-success';
	const info = `Checking on ${formatter.longDate(end)} (${formatter.money(lastDay.checking)}) minus checking now (${formatter.money(projection.checkingBalance)}), with nothing borrowed or moved from backup accounts.`;
	return (
		<TooltipButton label={info} isLabelledByContent>
			<span data-testid="projected-balances-net-change" className="ml-xs flex items-center gap-xs text-sm">
				<span className={`flex items-center gap-3xs font-medium ${tone}`}>
					<TrendIcon isUp={isUp} />
					{amount}
				</span>
				<span className="font-medium text-content-secondary">{`net by ${formatter.longDate(end)}`}</span>
			</span>
		</TooltipButton>
	);
}

interface StatBarProps {
	projection: Projection;
	range: ProjectionRange;
	split: FreeCashSplit | null;
	formatter: Formatter;
	onOpenGoals(): void;
}

function StatBar({ projection, range, split, formatter, onOpenGoals }: StatBarProps) {
	const { reversible, cushion } = projection;
	const kept = cushion > 0 ? `keep ${formatter.money(cushion)} in checking` : 'keep checking above $0';
	const lowestCreditLeft = range.lowestCreditLeft;
	const peakUtilization = range.peakUtilization;
	const maxedOut = range.firstEvent('cardMaxedOut');
	const outOfCash = range.firstEvent('outOfCash');
	const cushionUsed = range.firstEvent('cushionUsed');
	const cardsWithoutDueDate = range.cardsWithoutDueDate;
	const cardsWithoutAmount = range.cardsWithoutAmount;
	const hasEverydaySpending = [...projection.pace.monthlyByAccountId.values()].some(monthly => monthly > 0);
	let creditLeftTone = 'text-content-secondary';
	if (maxedOut) creditLeftTone = 'text-content-danger';
	else if (lowestCreditLeft !== null) creditLeftTone = 'text-content-primary';
	const unknownAmountNote = cardsWithoutAmount.length
		? ` ${cardsWithoutAmount.map(card => card.name).join(', ')} ${cardsWithoutAmount.length === 1 ? 'is' : 'are'} counted as $0, with no balance in Monarch or typical payment. Set a typical payment on its card payment in Recurring.`
		: '';
	const noDueDateNote = cardsWithoutDueDate.length
		? ` ${cardsWithoutDueDate.map(card => card.name).join(', ')} ${cardsWithoutDueDate.length === 1 ? "has no due date, so it's" : 'have no due date, so each is'} assumed due ${UNKNOWN_DUE_DAYS} days out. Add a card payment in Recurring to set one.`
		: '';

	return (
		<div data-testid="projected-balances-stat-bar" className="mx-default flex flex-wrap items-stretch rounded-sm border border-divider-primary">
			{projection.shortfall > 0 && reversible.firstShortDate ? (
				<Stat
					label={`Short from ${formatter.nearDate(reversible.firstShortDate)}`}
					info={`Bills and spending take checking this far below the amount you keep, at its lowest on ${formatter.nearDate(reversible.lowestDate)}. Card payments are planned around it. Move money into checking or lower the amount you keep in Edit cash and cards.`}
					value={formatter.money(projection.shortfall)}
					tone="text-content-danger"
				/>
			) : (
				<Stat
					label="Free cash today"
					info={`What you can spend today and still ${kept} through ${formatter.nearDate(reversible.endDate)}, with every bill, paycheck and card payment on its date and nothing borrowed. Pending purchases count as already spent; pending deposits count once they clear. Spend it, save it or put it toward a card.${noDueDateNote}${unknownAmountNote}`}
					value={formatter.money(projection.freeCash)}
					tone={projection.freeCash > 0 ? 'text-content-success' : 'text-content-primary'}
					detail={
						<>
							<Detail>{`Safe through ${formatter.nearDate(reversible.endDate)} · ${cushion > 0 ? `keeps ${formatter.money(cushion)}` : 'keeps checking above $0'}`}</Detail>
							{split && split.promised > 0 ? <FreeCashDetail split={split} formatter={formatter} onOpenGoals={onOpenGoals} /> : null}
						</>
					}
				/>
			)}
			<Stat
				label="Monthly surplus"
				info={`What's left in an average month over the next year: income minus bills and everyday spending. Spending on your cards counts, not the payments to them. Below $0, you fall behind over time.${hasEverydaySpending ? '' : " There's no full month of everyday spending yet, so it isn't counted."}`}
				value={formatter.money(projection.monthlySurplus)}
				tone={projection.monthlySurplus < 0 ? 'text-content-danger' : 'text-content-primary'}
				detail={hasEverydaySpending ? null : <Detail tone="text-content-warning">No everyday spending counted yet</Detail>}
			/>
			<Stat
				label="Credit left"
				info={
					lowestCreditLeft !== null
						? "The lowest available credit over the chart's range on the cards you borrow on, out of their total limit, and the highest share of it used on any day."
						: "None of the cards you borrow on has a credit limit in Monarch, so Wingspan can't tell when one would max out."
				}
				value={lowestCreditLeft !== null ? formatter.money(lowestCreditLeft) : 'Unknown'}
				tone={creditLeftTone}
				detail={
					<>
						{projection.creditLimit !== null && peakUtilization !== null ? (
							<Detail>{`of ${formatter.money(projection.creditLimit)} · ${formatter.percent(peakUtilization)} utilization`}</Detail>
						) : null}
						{maxedOut ? <Detail tone="text-content-danger">{`${maxedOut.label} ${formatter.nearDate(maxedOut.date)}`}</Detail> : null}
					</>
				}
			/>
			<Stat
				label="Checking runs out"
				info="The first day checking would go below $0 even after borrowing on your cards, moving money from backup accounts and using the amount you keep, in the order set in Edit cash and cards."
				value={outOfCash ? formatter.nearDate(outOfCash.date) : 'Stays above $0'}
				tone={outOfCash ? 'text-content-danger' : 'text-content-primary'}
				detail={<CheckingRunsOutDetail cushionUsedDate={cushionUsed?.date ?? null} isOutOfCash={!!outOfCash} endDate={range.endDate} formatter={formatter} />}
			/>
		</div>
	);
}

/** When checking first drops below the amount kept, or how long it stays above $0. */
function CheckingRunsOutDetail({ cushionUsedDate, isOutOfCash, endDate, formatter }: { cushionUsedDate: string | null; isOutOfCash: boolean; endDate: string; formatter: Formatter }) {
	if (cushionUsedDate) return <Detail tone="text-content-warning">{`Drops below the amount you keep ${formatter.nearDate(cushionUsedDate)}`}</Detail>;
	return isOutOfCash ? null : <Detail>{`Through ${formatter.nearDate(endDate)}`}</Detail>;
}

function FreeCashDetail({ split, formatter, onOpenGoals }: { split: FreeCashSplit; formatter: Formatter; onOpenGoals(): void }) {
	return (
		<Detail>
			<button type="button" className={`${LINK_BUTTON_CLASS_NAME} whitespace-nowrap`} onClick={onOpenGoals}>
				{`${formatter.money(split.promised)} to goals`}
			</button>
			{' · '}
			<span className={`whitespace-nowrap${split.trulyFree < 0 ? ' text-content-danger' : ''}`}>
				{split.trulyFree < 0 ? `${formatter.money(-split.trulyFree)} short of goals` : `${formatter.money(split.trulyFree)} truly free`}
			</span>
		</Detail>
	);
}

function Detail({ tone = 'text-content-secondary', children }: { tone?: string; children: ReactNode }) {
	return <span className={`text-xs font-medium ${tone}`}>{children}</span>;
}

function Stat({ label, info, value, tone = 'text-content-primary', detail }: StatProps) {
	return (
		<div data-external-id="stat-item" className="flex min-w-48 flex-1 flex-col items-start justify-start gap-2xs px-xl py-default not-last:border-r not-last:border-divider-primary">
			<div className="flex items-center gap-2xs text-content-secondary">
				<span data-mds="text" className="text-xs font-medium whitespace-nowrap text-content-secondary">
					{label}
				</span>
				<TooltipButton label={info}>
					<InfoIcon />
				</TooltipButton>
			</div>
			<div className="flex items-center gap-sm text-xl">
				<span className={`flex h-9 items-center font-medium whitespace-nowrap ${tone}`}>{value}</span>
			</div>
			{detail}
		</div>
	);
}
