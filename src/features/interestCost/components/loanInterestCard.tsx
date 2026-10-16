import type { ReactNode } from 'react';
import { DAYS_PER_YEAR, MONTHS_PER_YEAR } from '../../../common/money';
import { Banner } from '../../../monarch/ui/components/banner';
import { Button } from '../../../monarch/ui/components/button';
import { EditIcon } from '../../../monarch/ui/components/icons';
import { SkeletonText } from '../../../monarch/ui/components/skeleton';
import type { Formatter } from '../../../monarch/ui/formatter';
import { WingspanMark } from '../../wingspanMark';
import { InterestCost } from '../models/interestCost';
import type { LoanInterestView, ManualLoanView } from '../models/loanInterestView';

const TITLE = 'Interest';

export interface LoanInterestCardProps {
	view: LoanInterestView;
	formatter: Formatter;
	/** Null while there's no balance to update from: a loan Monarch syncs, or one still loading. */
	onUpdateBalance: (() => void) | null;
	onRetry(): void;
}

/** On a loan's page: what its interest costs a day, month and year, and for a manual loan, an estimated balance to update it with. */
export function LoanInterestCard({ view, formatter, onUpdateBalance, onRetry }: LoanInterestCardProps) {
	return (
		<section role="group" data-mds="card" aria-label={TITLE} className="z-0 flex flex-col overflow-hidden rounded-default bg-background-primary text-content-primary shadow-md">
			<div data-mds="card-header" className="flex items-center gap-2xs rounded-t-default border-b border-b-divider-primary bg-background-primary px-lg py-sm">
				<div data-mds="card-title" className="inline-block text-lg font-medium text-content-primary">
					{TITLE}
				</div>
				<WingspanMark />
				{onUpdateBalance ? (
					<div data-mds="card-action" className="ml-auto flex h-0 items-center gap-2xs">
						<Button leading={<EditIcon />} onClick={onUpdateBalance}>
							Update balance
						</Button>
					</div>
				) : null}
			</div>
			<InterestRow view={view} formatter={formatter} />
			{view.manual ? <ManualLoanRow manual={view.manual} formatter={formatter} onRetry={onRetry} /> : null}
		</section>
	);
}

function InterestRow({ view, formatter }: Pick<LoanInterestCardProps, 'view' | 'formatter'>) {
	if (view.rate === null) {
		return <Message>No interest rate in Monarch for this loan. Add it in the account's settings to see what the loan costs.</Message>;
	}

	const yearly = InterestCost.yearlyOf({ owed: view.owed, rate: view.rate });
	return (
		<div className="flex flex-col gap-2xs px-lg py-default">
			<span className="text-3xl font-medium text-content-primary">{`${formatter.money(yearly / DAYS_PER_YEAR)} a day`}</span>
			<span className="text-sm font-book text-content-secondary">{`${formatter.wholeMoney(yearly / MONTHS_PER_YEAR)} a month · ${formatter.wholeMoney(yearly)} a year, at ${view.rate}% on ${formatter.money(view.owed)}`}</span>
		</div>
	);
}

function ManualLoanRow({ manual, formatter, onRetry }: { manual: ManualLoanView; formatter: Formatter; onRetry(): void }) {
	if (manual.status === 'loading') {
		return (
			<div className="flex flex-col gap-sm border-t border-t-divider-primary px-lg py-default" aria-busy="true">
				<SkeletonText className="h-4 w-64" />
			</div>
		);
	}
	if (manual.status === 'failed') return <Message action={<Button onClick={onRetry}>Try again</Button>}>Couldn't load when this loan's balance was last entered.</Message>;
	if (manual.status === 'none') return <Message>Monarch has no balance for this loan yet. Enter one in Monarch to see an estimate.</Message>;

	const { entered, paymentsSince, estimate, hasLinkedPayment } = manual;
	const paid = paymentsSince.reduce((total, payment) => total + payment.amount, 0);
	const paymentsNote = paymentsSince.length ? `, minus ${formatter.money(paid)} paid since` : '';
	const paymentsPosted = paymentsSince.length === 1 ? `A ${formatter.money(paid)} payment posted` : `${paymentsSince.length} payments, ${formatter.money(paid)} in all, posted`;
	return (
		<div className="flex flex-col gap-2xs border-t border-t-divider-primary px-lg py-default text-sm font-book text-content-secondary">
			{paymentsSince.length ? (
				<div className="mb-xs">
					<Banner>{`${paymentsPosted} since this balance was entered. Update the balance once your servicer shows it.`}</Banner>
				</div>
			) : null}
			<span>{`Balance entered ${formatter.longDate(entered.date)}: ${formatter.money(entered.owed)}.`}</span>
			{estimate !== null ? <span className="text-content-primary">{`About ${formatter.money(estimate)} today, with interest since${paymentsNote}.`}</span> : null}
			{hasLinkedPayment ? null : <span>Open this loan's payment on Recurring and choose this loan under Pays toward, so the estimate takes off what you've paid.</span>}
		</div>
	);
}

function Message({ children, action }: { children: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-md border-t border-t-divider-primary px-lg py-default">
			<span className="text-sm font-book text-content-secondary">{children}</span>
			{action}
		</div>
	);
}
