import { Fragment, type ReactNode, useState } from 'react';
import type { Account } from '../../../../monarch/api/models/account';
import type { Transaction } from '../../../../monarch/api/models/transaction';
import { MerchantLogo, SmallAvatar } from '../../../../monarch/ui/components/avatar';
import { Checkbox } from '../../../../monarch/ui/components/checkbox';
import { FilterIcon } from '../../../../monarch/ui/components/icons';
import { MoneyInput } from '../../../../monarch/ui/components/input';
import { MultiSelect } from '../../../../monarch/ui/components/select';
import { Spinner } from '../../../../monarch/ui/components/spinner';
import type { TransactionsStatus } from '../../recurringItems/kinds/recurringItemKind';
import type { RecurringItemServices } from '../../recurringItems/services/recurringItemServices';

const MAX_SHOWN_TRANSACTIONS = 200;
const UNKNOWN_ACCOUNT_NAME = 'Unknown account';
const UNCATEGORIZED_NAME = 'Uncategorized';

/** Only `merchantName`'s transactions are listed, plus any already picked. `matchCard` is shown above the list. */
export interface TransactionPickerProps {
	transactions: Transaction[];
	status: TransactionsStatus;
	accounts: Account[];
	pickedIds: ReadonlySet<string>;
	merchantName: string | null;
	services: RecurringItemServices;
	matchCard: ReactNode;
	onChange(pickedIds: ReadonlySet<string>): void;
}

interface TransactionFilters {
	minimumAmount: number | null;
	maximumAmount: number | null;
	accountIds: string[];
	categoryIds: string[];
}

interface TransactionRowProps {
	transaction: Transaction;
	account: Account | undefined;
	isPicked: boolean;
	services: RecurringItemServices;
	onToggle(isPicked: boolean): void;
}

interface IdentityCellProps {
	leading: ReactNode;
	name: string;
	isEmphasized?: boolean;
}

interface CellTextProps {
	value: string;
	color?: 'primary' | 'secondary' | 'success';
	isEmphasized?: boolean;
	isEndAligned?: boolean;
}

interface EmojiProps {
	value: string;
}

interface FilterSelectProps {
	label: string;
	options: readonly (readonly [string, string, ReactNode])[];
	values: string[];
	onChange(values: string[]): void;
}

/** Newest first, grouped by month, at most 200 shown, with filters for amount, account and category. */
export function TransactionPicker({ transactions, status, accounts, pickedIds, merchantName, services, matchCard, onChange }: TransactionPickerProps) {
	const { formatter } = services;
	const [filters, setFilters] = useState<TransactionFilters>({ minimumAmount: null, maximumAmount: null, accountIds: [], categoryIds: [] });
	const accountsById = new Map(accounts.map(account => [account.id, account]));
	const changeFilters = (patch: Partial<TransactionFilters>) => setFilters(currentFilters => ({ ...currentFilters, ...patch }));

	const candidateTransactions = transactions.filter(transaction => pickedIds.has(transaction.id) || (!!merchantName && transaction.merchantName === merchantName));
	const filteredTransactions = candidateTransactions
		.filter(transaction => {
			const amount = Math.abs(transaction.amount);
			const isInAmountRange = amount >= (filters.minimumAmount ?? 0) && amount <= (filters.maximumAmount ?? Infinity);
			const isInAccounts = !filters.accountIds.length || filters.accountIds.includes(transaction.accountId ?? '');
			const isInCategories = !filters.categoryIds.length || filters.categoryIds.includes(transaction.category?.id ?? '');
			return isInAmountRange && isInAccounts && isInCategories;
		})
		.sort((a, b) => b.date.localeCompare(a.date));
	const shownTransactions = filteredTransactions.slice(0, MAX_SHOWN_TRANSACTIONS);
	const hasFilters = filters.minimumAmount !== null || filters.maximumAmount !== null || filters.accountIds.length > 0 || filters.categoryIds.length > 0;
	const transactionsByMonth = Map.groupBy(shownTransactions, transaction => transaction.date.slice(0, 7));

	const candidateAccounts = [...new Set(candidateTransactions.map(transaction => transaction.accountId))]
		.map(accountId => accountsById.get(accountId ?? ''))
		.filter((account): account is Account => account !== undefined)
		.sort((a, b) => a.displayName.localeCompare(b.displayName));
	const candidateCategories = [...new Map(candidateTransactions.flatMap(transaction => (transaction.category ? [[transaction.category.id, transaction.category] as const] : []))).values()].sort(
		(a, b) => a.name.localeCompare(b.name)
	);

	const togglePicked = (transactionId: string, isPicked: boolean) => {
		const nextPickedIds = new Set(pickedIds);
		if (isPicked) nextPickedIds.add(transactionId);
		else nextPickedIds.delete(transactionId);
		onChange(nextPickedIds);
	};

	return (
		<div className="flex flex-col gap-md">
			<div className="relative flex flex-col overflow-hidden rounded-md border border-border-primary h-[min(430px,calc(100dvh-18rem))]">
				<div className="flex flex-wrap items-center gap-md border-b border-b-divider-secondary px-md py-xs">
					<span className="inline-flex shrink-0 items-center gap-xs">
						<FilterIcon />
						<span data-mds="text" className="text-sm font-medium text-content-secondary">
							Filters
						</span>
					</span>
					<div className="flex items-center gap-xs">
						<span data-mds="text" className="text-sm font-book text-content-secondary">
							Amount
						</span>
						<label className="w-18">
							<span className="sr-only">Minimum amount</span>
							<MoneyInput size="sm" value={filters.minimumAmount} placeholder="min" formatter={formatter} onChange={minimumAmount => changeFilters({ minimumAmount })} />
						</label>
						<span data-mds="text" className="text-sm font-book text-content-secondary">
							–
						</span>
						<label className="w-18">
							<span className="sr-only">Maximum amount</span>
							<MoneyInput size="sm" value={filters.maximumAmount} placeholder="max" formatter={formatter} onChange={maximumAmount => changeFilters({ maximumAmount })} />
						</label>
					</div>
					<FilterSelect
						label="Account"
						options={candidateAccounts.map(account => [account.id, account.displayName, <SmallAvatar key="logo" name={account.displayName} logoUrl={account.logoUrl} />] as const)}
						values={filters.accountIds}
						onChange={accountIds => changeFilters({ accountIds })}
					/>
					<FilterSelect
						label="Category"
						options={candidateCategories.map(category => [category.id, category.name, category.icon ? <Emoji key="icon" value={category.icon} /> : null] as const)}
						values={filters.categoryIds}
						onChange={categoryIds => changeFilters({ categoryIds })}
					/>
				</div>
				<div className="relative isolate min-h-0 flex-1">
					{status === 'loading' ? (
						<div className="flex h-full items-center justify-center">
							<Spinner size="lg" />
						</div>
					) : status === 'failed' ? (
						<div className="flex h-full items-center justify-center px-xl text-center">
							<span data-mds="text" className="text-sm font-book text-content-secondary">
								Couldn't load transactions from Monarch. Close this and try again in a moment.
							</span>
						</div>
					) : shownTransactions.length ? (
						<ul className="m-0 h-full list-none overflow-y-auto overscroll-contain p-0">
							{[...transactionsByMonth].map(([month, monthTransactions]) => (
								<Fragment key={month}>
									<li className="sticky top-0 z-1 m-0 list-none bg-background-primary-hover px-md py-2xs">
										<span data-mds="text" className="text-xs font-medium text-content-secondary">
											{formatter.longMonthYear(`${month}-01`)}
										</span>
									</li>
									{monthTransactions.map(transaction => (
										<li key={transaction.id} className="m-0 list-none">
											<TransactionRow
												transaction={transaction}
												account={accountsById.get(transaction.accountId ?? '')}
												isPicked={pickedIds.has(transaction.id)}
												services={services}
												onToggle={isPicked => togglePicked(transaction.id, isPicked)}
											/>
										</li>
									))}
								</Fragment>
							))}
							{filteredTransactions.length > shownTransactions.length ? (
								<li className="list-none px-default py-sm text-xs text-content-secondary">{`The latest ${shownTransactions.length} of ${filteredTransactions.length}. Filter by amount, account or category to find older ones.`}</li>
							) : null}
							{matchCard ? <li className="h-28 shrink-0 list-none" aria-hidden="true" /> : null}
						</ul>
					) : (
						<div className={`flex h-full items-center justify-center px-xl text-center ${merchantName ? '' : 'bg-background-secondary'}`}>
							<span data-mds="text" className="text-sm font-book text-content-secondary">
								{!merchantName
									? 'Choose a merchant to see its transactions.'
									: hasFilters
										? 'No transactions match these filters.'
										: 'No transactions from this merchant in the data Wingspan has loaded.'}
							</span>
						</div>
					)}
					{matchCard}
				</div>
			</div>
		</div>
	);
}

function FilterSelect({ label, options, values, onChange }: FilterSelectProps) {
	return (
		<div className="flex min-w-0 items-center gap-xs">
			<span data-mds="text" className="text-sm font-book text-content-secondary">
				{label}
			</span>
			<MultiSelect size="sm" label={label} options={options} values={values} onChange={onChange} />
		</div>
	);
}

function TransactionRow({ transaction, account, isPicked, services, onToggle }: TransactionRowProps) {
	const { formatter } = services;
	const payee = transaction.merchantName || transaction.description;
	const accountName = account?.displayName ?? UNKNOWN_ACCOUNT_NAME;
	const isIncome = transaction.amount > 0;

	return (
		<div
			className="grid w-full grid-cols-[18px_3.5rem_minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1fr)_5.625rem] items-center gap-gutter px-sm py-xs border-b border-b-divider-primary cursor-pointer hover:bg-background-secondary"
			onClick={() => onToggle(!isPicked)}
		>
			<span className="flex" onClick={event => event.stopPropagation()}>
				<Checkbox size="sm" checked={isPicked} label={`Select ${payee} on ${formatter.longDate(transaction.date)} in ${accountName}`} onChange={onToggle} />
			</span>
			<CellText value={formatter.shortDate(transaction.date)} color="secondary" />
			<IdentityCell leading={<MerchantLogo url={transaction.logoUrl} />} name={payee} isEmphasized />
			<IdentityCell leading={transaction.category?.icon ? <Emoji value={transaction.category.icon} /> : null} name={transaction.category?.name ?? UNCATEGORIZED_NAME} />
			<IdentityCell leading={account ? <SmallAvatar name={accountName} logoUrl={account.logoUrl} /> : null} name={accountName} />
			<CellText value={`${isIncome ? '+' : ''}${formatter.money(Math.abs(transaction.amount))}`} color={isIncome ? 'success' : 'primary'} isEmphasized isEndAligned />
		</div>
	);
}

function IdentityCell({ leading, name, isEmphasized }: IdentityCellProps) {
	return (
		<div className="flex min-w-0 items-center gap-xs">
			{leading ? <span className="shrink-0">{leading}</span> : null}
			<div className="min-w-0">
				<CellText value={name} isEmphasized={isEmphasized} />
			</div>
		</div>
	);
}

function CellText({ value, color = 'primary', isEmphasized, isEndAligned }: CellTextProps) {
	const colorClassName = { primary: 'text-content-primary', secondary: 'text-content-secondary', success: 'text-content-success' }[color];

	return (
		<span className={`block w-full min-w-0 ${isEndAligned ? 'justify-self-end text-right' : ''}`} title={value}>
			<span data-mds="text" className={`block truncate text-sm ${isEmphasized ? 'font-medium' : 'font-book'} ${colorClassName}`}>
				{value}
			</span>
		</span>
	);
}

function Emoji({ value }: EmojiProps) {
	return (
		<span data-mds="emoji" className="mr-2xs inline-block">
			{value}
		</span>
	);
}
