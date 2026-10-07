import type { RootResolver } from './graphqlMock';

export interface StoredAccount {
	id: string;
	displayName: string;
	isHidden: boolean;
	notes: string | null;
	updatedAt: string;
	deletedAt: string | null;
}

export type WingspanValue = Record<string, unknown>;

interface MonarchRecurring {
	id: string;
	name: string;
	day: number;
	amount: number;
	recurringType: 'expense' | 'income' | 'credit_card' | 'transfer';
	/** Null when the account isn't in Monarch. */
	accountId: string | null;
	category: Category;
	isActive?: boolean;
}

interface Category {
	id: string;
	name: string;
	icon: string;
	group: { id: string; name: string; type: 'expense' | 'income' | 'transfer' };
}

const EXPENSES = { id: 'group-expenses', name: 'Expenses', type: 'expense' } as const;
const INCOME = { id: 'group-income', name: 'Income', type: 'income' } as const;
const TRANSFERS = { id: 'group-transfers', name: 'Transfers', type: 'transfer' } as const;

// The e2e setup can't reach Monarch's image CDN, so logo rendering is tested with a made-up logo.
const MERCHANT_LOGOS: Record<string, string> = {
	'Maple Music': `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fff"/><circle cx="32" cy="32" r="24" fill="#c0392b"/><circle cx="32" cy="32" r="14" fill="#fff"/><circle cx="32" cy="32" r="7" fill="#c0392b"/></svg>')}`
};

const NOTES_HEADER = "Do not edit. This data is managed by 'Wingspan for Monarch Money' extension.";

const CATEGORIES = {
	subscriptions: { id: 'cat-subscriptions', name: 'Subscriptions', icon: '📺', group: EXPENSES },
	utilities: { id: 'cat-utilities', name: 'Internet & Phone', icon: '📱', group: EXPENSES },
	rent: { id: 'cat-rent', name: 'Rent', icon: '🏠', group: EXPENSES },
	paychecks: { id: 'cat-paychecks', name: 'Paychecks', icon: '💰', group: INCOME },
	lessons: { id: 'cat-lessons', name: 'Lessons', icon: '🎹', group: EXPENSES },
	cardPayment: { id: 'cat-card-payment', name: 'Credit Card Payment', icon: '💳', group: TRANSFERS },
	coffee: { id: 'cat-coffee', name: 'Coffee Shops', icon: '☕', group: EXPENSES },
	groceries: { id: 'cat-groceries', name: 'Groceries', icon: '🍎', group: EXPENSES },
	gas: { id: 'cat-gas', name: 'Gas', icon: '⛽', group: EXPENSES }
} satisfies Record<string, Category>;

const BASE_ACCOUNTS = [
	{ id: 'acct-checking', displayName: 'Everyday Checking', currentBalance: 4210.55, isAsset: true, isHidden: false, type: { name: 'depository', display: 'Cash' } },
	{ id: 'acct-savings', displayName: 'High-Yield Savings', currentBalance: 12000, isAsset: true, isHidden: false, type: { name: 'depository', display: 'Cash' } },
	{ id: 'acct-vacation', displayName: 'Vacation Fund', currentBalance: 1500, isAsset: true, isHidden: false, type: { name: 'depository', display: 'Cash' } },
	{
		id: 'acct-rewards',
		displayName: 'Rewards Card (...1234)',
		currentBalance: -412.8,
		limit: 3000,
		apr: 22.9,
		minimumPayment: 35,
		isAsset: false,
		isHidden: false,
		type: { name: 'credit', display: 'Credit Cards' }
	},
	{ id: 'acct-flex', displayName: 'Flex Card (...5678)', currentBalance: -150, isAsset: false, isHidden: false, type: { name: 'credit', display: 'Credit Cards' } },
	{ id: 'acct-loan', displayName: 'Auto Loan', currentBalance: -9120, isAsset: false, isHidden: false, type: { name: 'loan', display: 'Loans' } },
	{ id: 'acct-closed', displayName: 'Closed Account', currentBalance: 5, isAsset: true, isHidden: true, type: { name: 'depository', display: 'Cash' } }
];

const BUSINESS = { id: 'biz-contoso', name: 'Contoso Pottery', color: '#ffc9b1', logoUrl: null };
const BUSINESS_ACCOUNTS = [
	{ id: 'acct-contoso', displayName: 'Contoso Checking', currentBalance: 6400, isAsset: true, isHidden: false, type: { name: 'depository', display: 'Cash' }, businessEntity: { id: BUSINESS.id } }
];
// Business items: its own Rent with the same name as the household's, and an inactive item. Gym Dues is a household item with no Monarch account.
const BUSINESS_RECURRING: MonarchRecurring[] = [
	{ id: 'rg-kiln', name: 'Kiln Lease', day: 20, amount: -310, recurringType: 'expense', accountId: 'acct-contoso', category: CATEGORIES.rent },
	{ id: 'rg-studio-rent', name: 'Rent', day: 5, amount: -900, recurringType: 'expense', accountId: 'acct-contoso', category: CATEGORIES.rent },
	{ id: 'rg-glaze', name: 'Glaze Supplier', day: 9, amount: -75, recurringType: 'expense', accountId: 'acct-contoso', category: CATEGORIES.subscriptions, isActive: false },
	{ id: 'rg-gym', name: 'Gym Dues', day: 11, amount: -30, recurringType: 'expense', accountId: null, category: CATEGORIES.subscriptions }
];

const MONARCH_RECURRING: MonarchRecurring[] = [
	{ id: 'rg-streaming', name: 'Streaming', day: 1, amount: -12.99, recurringType: 'expense', accountId: 'acct-rewards', category: CATEGORIES.subscriptions },
	{ id: 'rg-rent', name: 'Rent', day: 2, amount: -1450, recurringType: 'expense', accountId: 'acct-checking', category: CATEGORIES.rent },
	{ id: 'rg-phone', name: 'Phone', day: 14, amount: -42, recurringType: 'expense', accountId: 'acct-checking', category: CATEGORIES.utilities },
	{ id: 'rg-internet', name: 'Internet', day: 30, amount: -55, recurringType: 'expense', accountId: 'acct-checking', category: CATEGORIES.utilities },
	{ id: 'rg-pay-1', name: 'Paycheck', day: 1, amount: 3200, recurringType: 'income', accountId: 'acct-checking', category: CATEGORIES.paychecks },
	{ id: 'rg-pay-15', name: 'Paycheck', day: 15, amount: 3200, recurringType: 'income', accountId: 'acct-checking', category: CATEGORIES.paychecks }
];

/** Monarch's data for one test, dated relative to today. Every name and amount is invented. */
export class Household {
	private receiptSyncCount = 0;
	/** Receipts and orders Monarch already has, as its Retail Sync and Receipts pages list them. */
	public readonly existingReceipts: { merchantName: string; grandTotal: number; date: string }[] = [];
	private readonly storedAccounts: StoredAccount[] = [];
	private readonly today: string;
	private hasBusiness = false;
	private hasPlus = false;

	/** Today on the local calendar, as Wingspan and Monarch read it, not in UTC. */
	public constructor(today = Household.localToday()) {
		this.today = today;
	}

	/** Wingspan's sample items: a card in Monarch, two cards that aren't, and lessons paid by check. */
	public sampleItems(): WingspanValue {
		const since = this.addMonths(this.today.slice(0, 7), -3);
		const monthly = (day: number) => `DTSTART:${since.replace('-', '')}${String(day).padStart(2, '0')}T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${day}`;
		const recurringItems = [
			{ id: 'rewards', kind: 'card', name: 'Rewards Card', recurrence: monthly(17), amount: 0, active: true, since, accountId: 'acct-rewards' },
			{ id: 'store', kind: 'card', name: 'Store Card', recurrence: monthly(26), amount: 88.4, active: true, since, matchRule: { matchText: '4410', anyAmount: true } },
			{ id: 'travel', kind: 'card', name: 'Travel Card', recurrence: monthly(26), amount: 64.15, active: true, since, matchRule: { matchText: '8823', anyAmount: true } },
			{ id: 'piano', kind: 'bill', name: 'Piano Lessons', recurrence: monthly(1), amount: 140, active: true, since, matchRule: { matchText: 'Maple Music' } }
		];
		return { recurring: { trackingSince: since, recurringItems }, recurringDueDates: { dueDatesByRecurrenceId: {} }, cashSettings: { cushion: 0 } };
	}

	/** One bill another browser saved to the household's wingspan account. */
	public otherBrowserItems(): WingspanValue {
		const recurrence = 'DTSTART:20260103T000000Z\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=3';
		const gym = { id: 'gym', kind: 'bill', name: 'Gym', recurrence, amount: 45, active: true, since: '2026-01', matchRule: { matchText: 'Gym' } };
		return { recurring: { trackingSince: '2026-01', recurringItems: [gym] }, recurringDueDates: { dueDatesByRecurrenceId: {} }, cashSettings: { cushion: 0 } };
	}

	/** Puts items in the household's wingspan account, as another browser saving to Monarch would. */
	public seedWingspanAccount(value: WingspanValue): void {
		const notes = `${NOTES_HEADER}\n\n${JSON.stringify({ version: 1, etag: 'seeded', value })}`;
		this.storedAccounts.push({ id: 'acct-wingspan', displayName: 'wingspan', isHidden: true, notes, updatedAt: '2026-09-01T00:00:00Z', deletedAt: null });
	}

	/** Adds a business in Monarch's Settings, Businesses, with its own checking account and recurring items. Businesses are a Plus feature. */
	public addBusiness({ hasPlus = true } = {}): void {
		this.hasBusiness = true;
		this.hasPlus = hasPlus;
	}

	private get baseAccounts() {
		return this.hasBusiness ? [...BASE_ACCOUNTS, ...BUSINESS_ACCOUNTS] : BASE_ACCOUNTS;
	}

	private get monarchRecurring(): MonarchRecurring[] {
		return this.hasBusiness ? [...MONARCH_RECURRING, ...BUSINESS_RECURRING] : MONARCH_RECURRING;
	}

	public get wingspanAccounts(): readonly StoredAccount[] {
		return this.storedAccounts.filter(account => !account.deletedAt);
	}

	/** Deletes the wingspan account, as someone removing it in Monarch would. */
	public deleteWingspanAccounts(): void {
		for (const account of this.storedAccounts) account.deletedAt ??= this.now();
	}

	public get resolvers(): Record<string, RootResolver> {
		return {
			me: () => ({
				id: 'user-1',
				name: 'Test User',
				displayName: 'Test',
				email: 'test@example.com',
				timezone: 'America/Chicago',
				householdRole: 'OWNER',
				createdAt: '2024-01-01T00:00:00Z',
				profile: this.seenProfile()
			}),
			userProfile: () => this.seenProfile(),
			householdPreferences: () => ({ id: 'household-1', recurrenceExperience: { canAccessV1: true, canAccessV2: true, canSwitch: true, offer: null } }),
			recurrenceGroupDetectionStatus: () => ({ isFirstRun: false, isRunning: false, failedAt: null, finishedAt: `${this.today}T06:00:00Z`, lastDetectedAt: `${this.today}T06:00:00Z` }),
			hasAccounts: () => true,
			categoryGroups: () =>
				[EXPENSES, INCOME, TRANSFERS].map((group, groupOrder) => ({
					...group,
					order: groupOrder,
					categories: Object.values(CATEGORIES)
						.filter(category => category.group.id === group.id)
						.map((category, order) => ({ ...category, order }))
				})),
			// Monarch shows its business filter only on its Plus plan.
			subscription: () => ({ id: 'subscription-1', entitlements: this.hasPlus ? ['premium_plus'] : [], plusTrialEndsAt: null, canceledPlusTrialAt: null }),
			businessEntities: () => (this.hasBusiness ? [{ ...BUSINESS, icon: 'briefcase', structure: 'llc', accounts: BUSINESS_ACCOUNTS, accountsCount: 1, transactionsCount: 0 }] : []),
			// None belong to a business; otherwise the mock would fill the field with an empty business.
			accounts: () => [...this.baseAccounts, ...this.wingspanAccounts.map(account => this.toMonarchAccount(account))].map(account => ({ businessEntity: null, ...account })),
			account: ({ id }) => {
				const stored = this.storedAccounts.find(account => account.id === id);
				return stored ? this.toMonarchAccount(stored) : (this.baseAccounts.find(account => account.id === id) ?? null);
			},
			allTransactions: () => {
				const results = this.transactions();
				return { totalCount: results.length, results };
			},
			budgetData: ({ startMonth }) => ({
				monthlyAmountsByCategory: [
					{ category: { ...CATEGORIES.groceries, budgetVariability: 'flexible' }, monthlyAmounts: [{ month: startMonth, plannedCashFlowAmount: 300 }] },
					{ category: { ...CATEGORIES.gas, budgetVariability: 'flexible' }, monthlyAmounts: [{ month: startMonth, plannedCashFlowAmount: 80 }] }
				]
			}),
			savingsGoalMonthlyBudgetAmounts: ({ startMonth, endMonth }) => [
				{
					id: 'goal-amounts-1',
					savingsGoal: { id: 'goal-1', name: 'Rainy Day', archivedAt: null },
					monthlyAmounts: this.monthsBetween(String(startMonth), String(endMonth)).map(month => ({
						id: `goal-1-${month}`,
						month: `${month}-01`,
						plannedAmount: 250,
						remainingAmount: month === this.today.slice(0, 7) ? 150 : 250
					}))
				}
			],
			aggregates: ({ filters, groupBy }) => this.aggregates(filters as { startDate?: string; endDate?: string } | null, (groupBy as string[] | null) ?? []),
			recurrenceGroupsForPeriod: ({ startDate, endDate }) => this.recurrenceRows(String(startDate ?? this.today), String(endDate ?? startDate ?? this.today)),
			aggregatedRecurrenceGroups: ({ startDate, endDate, filters }) => this.summary(String(startDate), String(endDate), (filters as { accounts?: string[] } | null)?.accounts),
			createBulkRetailSync: ({ input }) => ({
				retailSyncs: Array.from({ length: Number((input as { count: number }).count) }, () => ({ id: `retail-sync-${++this.receiptSyncCount}` })),
				errors: null
			}),
			startRetailSync: ({ id }) => ({ retailSync: { id }, errors: null }),
			retailOrdersConnection: () => ({
				pageInfo: { hasNextPage: false, endCursor: null },
				edges: this.existingReceipts.map((receipt, index) => ({ cursor: String(index), node: { id: `retail-order-${index}`, ...receipt } }))
			}),
			createManualAccount: ({ input }) => {
				const { name } = input as { name: string };
				const account: StoredAccount = { id: `acct-manual-${this.storedAccounts.length + 1}`, displayName: name, isHidden: false, notes: null, updatedAt: this.now(), deletedAt: null };
				this.storedAccounts.push(account);
				return { account: this.toMonarchAccount(account), errors: null };
			},
			updateAccount: ({ input }) => {
				const { id, notes, hideFromList, name } = input as { id: string; notes?: string; hideFromList?: boolean; name?: string };
				const account = this.storedAccounts.find(candidate => candidate.id === id);
				if (!account) return { account: null, errors: { message: 'Account not found' } };
				if (notes !== undefined) account.notes = notes;
				if (hideFromList !== undefined) account.isHidden = hideFromList;
				if (name !== undefined) account.displayName = name;
				account.updatedAt = this.now();
				return { account: this.toMonarchAccount(account), errors: null };
			},
			deleteAccount: ({ id }) => {
				const account = this.storedAccounts.find(candidate => candidate.id === id);
				if (account) account.deletedAt = this.now();
				return { deleted: !!account, errors: null };
			}
		};
	}

	private seenProfile() {
		const seenAt = new Date().toISOString();
		return { id: 'profile-1', dismissedRecurringV2WalkthroughAt: seenAt, dismissedRecurringWalkthroughAt: seenAt, hasSeenCategoriesManagementTour: true, hasDismissedWhatsNewAt: seenAt };
	}

	private toMonarchAccount(account: StoredAccount) {
		return { ...account, currentBalance: 0, isAsset: true, type: { name: 'other_asset', display: 'Other' } };
	}

	private recurrenceRows(startDate: string, endDate: string) {
		return this.monthsBetween(startDate, endDate).flatMap(month =>
			this.monarchRecurring.map(recurring => {
				// A day past the end of the month is clamped to its last day, like Monarch does.
				const date = `${month}-${String(Math.min(recurring.day, this.daysIn(month))).padStart(2, '0')}`;
				const status = date < this.today ? 'paid' : 'upcoming';
				const account = this.baseAccounts.find(candidate => candidate.id === recurring.accountId) ?? null;
				return {
					id: `${recurring.id}-${month}`,
					status,
					date,
					amount: recurring.amount,
					previousAmount: recurring.amount,
					lastDate: status === 'paid' ? date : null,
					lastDateIsPaid: status === 'paid',
					nextDate: date,
					recurringType: recurring.recurringType,
					account,
					category: recurring.category,
					occurrences: [{ date, status, amount: recurring.amount, account, category: recurring.category }],
					recurrenceGroup: {
						id: recurring.id,
						name: recurring.name,
						frequency: 'monthly',
						recurringType: recurring.recurringType,
						amount: recurring.amount,
						isActive: recurring.isActive ?? true,
						isApproximate: false,
						isNew: false,
						createdAt: '2026-01-01T00:00:00Z',
						status,
						account,
						category: recurring.category,
						merchant: { id: `merchant-${recurring.id}`, name: recurring.name, logoUrl: null }
					}
				};
			})
		);
	}

	/** Only the recurring items on these accounts, when Monarch's Filters name some. */
	private summary(startDate: string, endDate: string, accountIds?: string[]) {
		const rows = this.recurrenceRows(startDate, endDate).filter(row => row.recurrenceGroup.isActive && (!accountIds?.length || accountIds.includes(row.account?.id ?? '')));
		const totals = (type: MonarchRecurring['recurringType']) => {
			const ofType = rows.filter(row => row.recurringType === type);
			const completed = ofType.filter(row => row.status === 'paid').reduce((total, row) => total + Math.abs(row.amount), 0);
			const total = ofType.reduce((sum, row) => sum + Math.abs(row.amount), 0);
			return { completed, remaining: total - completed, total, count: ofType.length, pendingAmountCount: 0 };
		};
		return { expense: totals('expense'), creditCard: totals('credit_card'), income: totals('income'), transfer: totals('transfer') };
	}

	/** Cash Flow's totals: one row for the range, or one per month, quarter or year. Grouping by category, group or merchant returns nothing. */
	private aggregates(filters: { startDate?: string; endDate?: string } | null, groupBy: string[]) {
		const startDate = filters?.startDate ?? '0000-01-01';
		const endDate = filters?.endDate ?? this.today;
		const inRange = this.transactions().filter(transaction => transaction.date >= startDate && transaction.date <= endDate && transaction.category.group.type !== 'transfer');
		const summaryOf = (transactions: typeof inRange) => {
			const sumIncome = transactions.filter(transaction => transaction.amount > 0).reduce((total, transaction) => total + transaction.amount, 0);
			const sumExpense = transactions.filter(transaction => transaction.amount < 0).reduce((total, transaction) => total + transaction.amount, 0);
			const savings = sumIncome + sumExpense;
			return { sum: savings, sumIncome, sumExpense, savings, savingsRate: sumIncome ? savings / sumIncome : 0 };
		};

		const period = groupBy.find(key => key === 'month' || key === 'quarter' || key === 'year');
		if (!groupBy.length) return [{ groupBy: {}, summary: summaryOf(inRange) }];
		if (!period) return [];

		const startOf = (date: string) => {
			if (period === 'year') return `${date.slice(0, 4)}-01-01`;
			if (period === 'quarter') return `${date.slice(0, 5)}${String(Math.floor((Number(date.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
			return `${date.slice(0, 7)}-01`;
		};
		const byPeriod = Map.groupBy(inRange, transaction => startOf(transaction.date));
		return [...byPeriod].sort(([a], [b]) => a.localeCompare(b)).map(([periodStart, transactions]) => ({ groupBy: { [period]: periodStart }, summary: summaryOf(transactions) }));
	}

	private transactions() {
		const transaction = (id: string, date: string, amount: number, plaidName: string, merchant: string, accountId: string, category: Category) => ({
			id,
			date,
			amount,
			pending: false,
			plaidName,
			merchant: { id: `merchant-${merchant}`, name: merchant, logoUrl: MERCHANT_LOGOS[merchant] ?? null },
			category,
			account: BASE_ACCOUNTS.find(account => account.id === accountId)
		});
		return [
			// The rewards card paid in full around the 17th; each payment is posted to the card's own account. None is dated after today.
			...[0, 1, 2, 3, 4, 5]
				.filter(monthsAgo => this.monthDay(monthsAgo, 17) <= this.today)
				.map(monthsAgo => transaction(`tx-rewards-${monthsAgo}`, this.monthDay(monthsAgo, 17), 600 + monthsAgo * 70, 'PAYMENT THANK YOU', 'Rewards Bank', 'acct-rewards', CATEGORIES.cardPayment)),
			// Two cards Monarch doesn't have; their payments come out of checking with a consistent card number.
			...[1, 2, 3].map(monthsAgo => transaction(`tx-store-${monthsAgo}`, this.monthDay(monthsAgo, 26), -88.4, 'STORECARD PAYMENT ***4410', 'Store Card', 'acct-checking', CATEGORIES.cardPayment)),
			...[1, 2, 3].map(monthsAgo =>
				transaction(`tx-travel-${monthsAgo}`, this.monthDay(monthsAgo, 26), -(64.15 + monthsAgo * 10), 'TRAVELCARD PAYMENT ***8823', 'Travel Card', 'acct-checking', CATEGORIES.cardPayment)
			),
			// Lessons paid by check, cashed on no fixed schedule.
			transaction('tx-check-1', this.monthDay(1, 20), -140, 'CHECK # 0000002031', 'Maple Music', 'acct-checking', CATEGORIES.lessons),
			transaction('tx-check-2', this.monthDay(3, 9), -140, 'CHECK # 0000002024', 'Maple Music', 'acct-checking', CATEGORIES.lessons),
			transaction('tx-coffee', this.dayOffset(-2), -5.25, 'CORNER CAFE', 'Corner Cafe', 'acct-rewards', CATEGORIES.coffee),
			// Everyday spending: groceries on the rewards card, gas from checking.
			...[1, 2, 3, 4, 5, 6].map(monthsAgo =>
				transaction(`tx-grocer-${monthsAgo}`, this.monthDay(monthsAgo, 8), -(300 + monthsAgo * 10), 'GREEN GROCER', 'Green Grocer', 'acct-rewards', CATEGORIES.groceries)
			),
			transaction('tx-grocer-0', this.today, -45, 'GREEN GROCER', 'Green Grocer', 'acct-rewards', CATEGORIES.groceries),
			...[1, 2, 3, 4, 5, 6].map(monthsAgo => transaction(`tx-gas-${monthsAgo}`, this.monthDay(monthsAgo, 12), -60, 'FUEL STOP', 'Fuel Stop', 'acct-checking', CATEGORIES.gas)),
			// Paychecks are deposited to checking; Monarch's recurring items cover them, so they're marked recurring.
			...[1, 2, 3, 4, 5, 6].flatMap(monthsAgo =>
				[1, 15].map(day => ({
					...transaction(`tx-pay-${monthsAgo}-${day}`, this.monthDay(monthsAgo, day), 3200, 'EMPLOYER PAYROLL', 'Employer', 'acct-checking', CATEGORIES.paychecks),
					isRecurring: true
				}))
			)
		];
	}

	private monthsBetween(startDate: string, endDate: string): string[] {
		const months: string[] = [];
		for (let month = startDate.slice(0, 7); month <= endDate.slice(0, 7); month = this.addMonths(month, 1)) months.push(month);
		return months;
	}

	private addMonths(month: string, by: number): string {
		const date = new Date(`${month}-01T00:00:00Z`);
		date.setUTCMonth(date.getUTCMonth() + by);
		return date.toISOString().slice(0, 7);
	}

	private static localToday(): string {
		const now = new Date();
		return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
	}

	private daysIn(month: string): number {
		return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
	}

	private monthDay(monthsAgo: number, day: number): string {
		return `${this.addMonths(this.today.slice(0, 7), -monthsAgo)}-${String(day).padStart(2, '0')}`;
	}

	private dayOffset(days: number): string {
		return new Date(Date.parse(`${this.today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
	}

	private now(): string {
		return new Date().toISOString();
	}
}
