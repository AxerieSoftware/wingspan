import { type MouseEvent, type ReactNode, useState } from 'react';
import type { TaggedTransaction } from '../../../../monarch/api/models/taggedTransaction';
import { MerchantLogo } from '../../../../monarch/ui/components/avatar';
import { Button } from '../../../../monarch/ui/components/button';
import { ChevronIcon, EditIcon, Icon } from '../../../../monarch/ui/components/icons';
import { SkeletonText } from '../../../../monarch/ui/components/skeleton';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { WingspanMark } from '../../../wingspanMark';
import type { HsaExpenses } from '../models/hsaExpenses';

const TITLE = 'HSA reimbursements';
const SECTION_HEADER_CLASS_NAME = 'flex h-9 w-full items-center justify-between bg-background-secondary px-lg text-sm font-medium text-content-secondary';

/** What the card shows: loading, a failed load, no tag to read, or the tagged expenses. */
export type HsaReimbursementsView =
	| { status: 'loading' }
	| { status: 'failed' }
	| { status: 'noTag' }
	| { status: 'ready'; expenses: HsaExpenses; toReimburseTagName: string; hasReimbursedTag: boolean };

export interface HsaReimbursementsCardProps {
	view: HsaReimbursementsView;
	formatter: Formatter;
	transactionHref(transactionId: string): string;
	onOpenTransaction(transactionId: string): void;
	onChooseTags(): void;
	onRetry(): void;
}

interface ExpenseRowProps {
	expense: TaggedTransaction;
	formatter: Formatter;
	href: string;
	onOpen(): void;
}

interface CardMessageProps {
	children: ReactNode;
	action?: ReactNode;
}

/** The HSA account's medical expenses to pay back from the HSA, from transactions tagged in Monarch, and those already paid back. */
export function HsaReimbursementsCard({ view, formatter, transactionHref, onOpenTransaction, onChooseTags, onRetry }: HsaReimbursementsCardProps) {
	return (
		<section role="group" data-mds="card" aria-label={TITLE} className="z-0 flex flex-col overflow-hidden rounded-default bg-background-primary text-content-primary shadow-md">
			<div data-mds="card-header" className="flex items-center gap-2xs rounded-t-default border-b border-b-divider-primary bg-background-primary px-lg py-sm">
				<div data-mds="card-title" className="inline-block text-lg font-medium text-content-primary">
					{TITLE}
				</div>
				<WingspanMark />
				{view.status === 'ready' ? (
					<div data-mds="card-action" className="ml-auto flex h-0 items-center gap-2xs">
						<Button leading={<EditIcon />} onClick={onChooseTags}>
							Choose tags
						</Button>
					</div>
				) : null}
			</div>
			<CardBody view={view} formatter={formatter} transactionHref={transactionHref} onOpenTransaction={onOpenTransaction} onChooseTags={onChooseTags} onRetry={onRetry} />
		</section>
	);
}

function CardBody({ view, formatter, transactionHref, onOpenTransaction, onChooseTags, onRetry }: HsaReimbursementsCardProps) {
	const [isShowingReimbursed, setIsShowingReimbursed] = useState(false);

	if (view.status === 'loading') {
		return (
			<div className="flex flex-col gap-sm p-lg" aria-busy="true">
				<SkeletonText className="h-8 w-40" />
				<SkeletonText className="h-4 w-64" />
			</div>
		);
	}
	if (view.status === 'failed') return <CardMessage action={<Button onClick={onRetry}>Try again</Button>}>Couldn't load your tagged expenses from Monarch.</CardMessage>;
	if (view.status === 'noTag') {
		return (
			<CardMessage action={<Button onClick={onChooseTags}>Choose tags</Button>}>
				Tag the medical expenses you paid yourself and plan to reimburse from your HSA, then choose that tag here. Keep each receipt and any notes on the transaction in Monarch.
			</CardMessage>
		);
	}

	const { expenses, toReimburseTagName, hasReimbursedTag } = view;
	const missingReceipts = expenses.toReimburse.filter(expense => !expense.hasAttachments).length;
	const rowFor = (expense: TaggedTransaction) => (
		<ExpenseRow key={expense.id} expense={expense} formatter={formatter} href={transactionHref(expense.id)} onOpen={() => onOpenTransaction(expense.id)} />
	);

	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-2xs px-lg py-default">
				<span className="text-3xl font-medium text-content-primary">{formatter.money(expenses.toReimburseTotal)}</span>
				<span className="text-sm font-book text-content-secondary">
					{`to reimburse from your HSA · ${countOf(expenses.toReimburse.length, 'expense')}`}
					{missingReceipts ? <span className="text-content-warning">{` · ${countOf(missingReceipts, 'without a receipt', 'without a receipt')}`}</span> : null}
				</span>
			</div>
			{expenses.toReimburse.length ? (
				<ul aria-label="Expenses to reimburse" className="m-0 list-none p-0">
					{expenses.toReimburse.map(rowFor)}
				</ul>
			) : (
				<p className="m-0 border-t border-t-divider-primary px-lg py-default text-sm font-book text-content-secondary">{`Nothing to reimburse. Expenses tagged ${toReimburseTagName} show here, oldest first.`}</p>
			)}
			{hasReimbursedTag ? (
				<>
					<button
						type="button"
						aria-expanded={isShowingReimbursed}
						disabled={!expenses.reimbursed.length}
						className={`${SECTION_HEADER_CLASS_NAME} cursor-pointer border-0 text-left disabled:cursor-default`}
						onClick={() => setIsShowingReimbursed(isShowing => !isShowing)}
					>
						<span className="flex items-center gap-2xs">
							<span className={`inline-flex transition-transform ${isShowingReimbursed ? '' : '-rotate-90'}`}>
								<ChevronIcon />
							</span>
							{`Reimbursed · ${countOf(expenses.reimbursed.length, 'expense')}`}
						</span>
						<span>{formatter.money(expenses.reimbursedTotal)}</span>
					</button>
					{isShowingReimbursed && expenses.reimbursed.length ? (
						<ul aria-label="Reimbursed expenses" className="m-0 list-none p-0">
							{expenses.reimbursed.map(rowFor)}
						</ul>
					) : null}
				</>
			) : null}
		</div>
	);
}

/** Links to the transaction in Monarch, opening it in place unless a modifier asks for a new tab. */
function ExpenseRow({ expense, formatter, href, onOpen }: ExpenseRowProps) {
	const date = formatter.longDate(expense.date);
	const openInPlace = (event: MouseEvent) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		onOpen();
	};

	return (
		<li className="m-0 list-none border-t border-t-divider-primary">
			<a
				href={href}
				aria-label={`${expense.merchantName}, ${date}, ${formatter.money(-expense.amount)}${expense.hasAttachments ? '' : ', no receipt'}`}
				className="flex items-center gap-sm px-lg py-sm text-content-primary no-underline transition-colors hover:bg-background-secondary"
				onClick={openInPlace}
			>
				<MerchantLogo url={expense.logoUrl} />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-base font-medium">{expense.merchantName}</span>
					<span className="truncate text-sm font-book text-content-secondary">{[date, expense.accountName].filter(Boolean).join(' · ')}</span>
					{expense.notes ? (
						<span className="truncate text-sm font-book text-content-secondary" title={expense.notes}>
							{expense.notes}
						</span>
					) : null}
				</span>
				{expense.hasAttachments ? (
					<span className="shrink-0 text-sm font-book text-content-secondary">Receipt</span>
				) : (
					<span className="flex shrink-0 items-center gap-2xs text-sm font-book text-content-warning">
						<Icon shape="alert" size={14} />
						No receipt
					</span>
				)}
				<span className="w-24 shrink-0 text-right text-base font-medium">{formatter.money(-expense.amount)}</span>
			</a>
		</li>
	);
}

function CardMessage({ children, action }: CardMessageProps) {
	return (
		<div className="flex flex-col items-start gap-sm px-lg py-default">
			<p className="m-0 text-sm font-book text-content-secondary">{children}</p>
			{action}
		</div>
	);
}

function countOf(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}
