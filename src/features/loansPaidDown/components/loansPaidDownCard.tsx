import type { SummaryCardLook } from '../../../monarch/pages/summaryRow';
import type { Formatter } from '../../../monarch/ui/formatter';
import { SummaryStatCard } from '../../summaryScreens/components/summaryStatCard';
import type { SummaryDates } from '../../summaryScreens/models/summaryScreen';
import type { LoansPaidDown } from '../models/loansPaidDown';

const NAME = 'Loans paid down';

/** Loading, loaded or failed; there's no card at all when no loan shown has a balance at the period's start. */
export type LoansPaidDownState = { status: 'loading' } | { status: 'ready'; paydown: LoansPaidDown } | { status: 'failed' };

export interface LoansPaidDownCardProps {
	look: SummaryCardLook;
	state: LoansPaidDownState;
	dates: SummaryDates;
	/** The last day balances are read for: the end date, or today while the dates are still going. */
	balancesThrough: string;
	formatter: Formatter;
}

/** The summary card for how much the loans went down, beside Monarch's Savings rate. */
export function LoansPaidDownCard({ look, state, dates, balancesThrough, formatter }: LoansPaidDownCardProps) {
	return <SummaryStatCard look={look} name={NAME} value={formatValue(state, formatter)} label={labelFor(state, formatter)} info={infoFor(state, dates, balancesThrough, formatter)} />;
}

/** Null while loading. */
function formatValue(state: LoansPaidDownState, formatter: Formatter): string | null {
	if (state.status === 'loading') return null;
	return state.status === 'failed' ? 'Unavailable' : formatter.wholeMoney(state.paydown.amount);
}

/** The share of income, when there's income to compare against, follows the name. */
function labelFor(state: LoansPaidDownState, formatter: Formatter): string {
	const shareOfIncome = state.status === 'ready' ? state.paydown.shareOfIncome : null;
	return shareOfIncome === null ? NAME : `${NAME} · ${formatter.percent(shareOfIncome)} of income`;
}

function infoFor(state: LoansPaidDownState, dates: SummaryDates, balancesThrough: string, formatter: Formatter): string {
	if (state.status === 'failed') return "Couldn't load your loans from Monarch. Wingspan tries again in a minute.";
	const range = `${formatter.longDate(dates.startDate)} through ${formatter.longDate(balancesThrough)}`;
	const explanation = `How much your loans went down from ${range}: what you paid minus interest added, and that as a share of your income.`;
	if (state.status === 'loading') return explanation;

	const byLoan = state.paydown.loans.map(loan => `${loan.name} ${formatter.money(loan.amount)}${loan.isFromPayments ? ' (its linked payments minus estimated interest)' : ''}`).join('; ');
	return `${explanation} By loan: ${byLoan}.`;
}
