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
	/** The merchant its payments go to, when it isn't named after the item. */
	merchant?: string;
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
	clientPayments: { id: 'cat-client-payments', name: 'Client Payments', icon: '🧾', group: INCOME },
	lessons: { id: 'cat-lessons', name: 'Lessons', icon: '🎹', group: EXPENSES },
	cardPayment: { id: 'cat-card-payment', name: 'Credit Card Payment', icon: '💳', group: TRANSFERS },
	coffee: { id: 'cat-coffee', name: 'Coffee Shops', icon: '☕', group: EXPENSES },
	groceries: { id: 'cat-groceries', name: 'Groceries', icon: '🍎', group: EXPENSES },
	gas: { id: 'cat-gas', name: 'Gas', icon: '⛽', group: EXPENSES },
	medical: { id: 'cat-medical', name: 'Medical', icon: '💊', group: EXPENSES },
	loanPayment: { id: 'cat-loan-payment', name: 'Loan Repayment', icon: '🚗', group: EXPENSES }
} satisfies Record<string, Category>;

/** An order Monarch's retail sync split by category, as `addSyncedOrder` adds it: the charge and its receipt's items. */
const SYNCED_ORDER = {
	id: 'tx-order',
	amount: -139.14,
	merchant: 'Contoso Market',
	link: 'https://www.example.com/orders/5521',
	items: [
		{ line: '1 x Fabrikam Espresso Maker - $167.99', categoryId: 'cat-groceries' },
		{ line: '2 x Contoso Paper Towels - 12 Rolls - $11.99', categoryId: 'cat-groceries' },
		{ line: '1 x Fabrikam Coffee Pods™ - $12.99', categoryId: 'cat-coffee' },
		{ line: '1 x Contoso Allergy Relief - $9.49', categoryId: 'cat-medical' }
	]
};
/** The synced order's splits as Monarch's retail sync made them: the charge shared out by price. */
const SYNCED_ORDER_SPLITS = [
	{ categoryId: 'cat-groceries', amount: -124.55, itemIndexes: [0, 1] },
	{ categoryId: 'cat-coffee', amount: -8.43, itemIndexes: [2] },
	{ categoryId: 'cat-medical', amount: -6.16, itemIndexes: [3] }
];

/** Goals on Monarch's Save up page. `targetDate` is how many months from now it's due, if it has a date. */
const SAVINGS_GOALS = [
	{
		id: 'goal-1',
		type: 'savings',
		name: 'Rainy Day',
		status: 'on_track',
		currentBalance: 1200,
		targetAmount: 6000,
		targetDate: null as number | null,
		archivedAt: null,
		completedAt: null,
		linkedAccountId: null as string | null
	},
	{
		id: 'goal-2',
		type: 'savings',
		name: 'Contoso Cruise',
		status: 'at_risk',
		currentBalance: 400,
		targetAmount: 3000,
		targetDate: 14 as number | null,
		archivedAt: null,
		completedAt: null,
		// Held in the Vacation Fund, which grows at 4% a year.
		linkedAccountId: 'acct-vacation' as string | null
	}
];
/** Retirement goals added by `addRetirementGoals`: one held in a 401(k), paid into from the paycheck, and a Roth IRA paid from checking. */
const RETIREMENT_GOALS = [
	{
		id: 'goal-3',
		type: 'retirement',
		name: 'Retirement – 401(k)',
		status: 'on_track',
		currentBalance: 42000,
		targetAmount: 900000,
		targetDate: 300 as number | null,
		archivedAt: null,
		completedAt: null,
		linkedAccountId: 'acct-401k' as string | null
	},
	{
		id: 'goal-4',
		type: 'retirement',
		name: 'Retirement – Roth IRA',
		status: 'on_track',
		currentBalance: 8000,
		targetAmount: 200000,
		targetDate: 300 as number | null,
		archivedAt: null,
		completedAt: null,
		linkedAccountId: null as string | null
	}
];
const RETIREMENT_ACCOUNT = {
	id: 'acct-401k',
	displayName: 'Fabrikam 401(k)',
	currentBalance: 42000,
	isAsset: true,
	isHidden: false,
	type: { name: 'brokerage', display: 'Investments' },
	subtype: { name: 'st_401k', display: '401k' }
};
const GROWTH_RATES: Record<string, number> = { 'acct-vacation': 4, 'acct-401k': 7 };

/** The filters Cash Flow, Budget and category pages pass to `aggregates`. */
interface AggregateFilters {
	startDate?: string;
	endDate?: string;
	categories?: string[];
	accounts?: string[];
	excludeAccounts?: string[];
	tags?: string[];
}

/** How Budget groups each expense category. Income categories have none. */
const BUDGET_VARIABILITY: Record<string, string> = {
	'cat-subscriptions': 'fixed',
	'cat-utilities': 'fixed',
	'cat-rent': 'fixed',
	'cat-loan-payment': 'fixed',
	'cat-lessons': 'flexible',
	'cat-coffee': 'flexible',
	'cat-groceries': 'flexible',
	'cat-gas': 'flexible',
	'cat-medical': 'flexible'
};
/** Each month's planned amount per category in Budget. */
const BUDGET_PLANNED: Record<string, number> = { 'cat-paychecks': 6400, 'cat-rent': 1500, 'cat-groceries': 300, 'cat-gas': 80, 'cat-medical': 50 };

/** How many months from now `addThirdPaycheckMonth` budgets the extra paycheck. */
const THIRD_PAYCHECK_MONTHS_AHEAD = 4;

/** The auto loan's monthly payment, which all goes to its balance. */
const LOAN_PAYMENT = 340;
/** Numeric like Monarch's, since Wingspan reads an open item's id from its path. */
const AUTO_LOAN_GROUP_ID = '9001';
/** How many days ago the auto loan's balance was last entered. */
const LOAN_ENTERED_DAYS_AGO = 5;
/** How many days of balances Monarch has for the auto loan, for when it was last entered. */
const LOAN_SNAPSHOT_DAYS = 40;

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
	// Entered by hand: its balance was last entered five days ago.
	{ id: 'acct-loan', displayName: 'Auto Loan', currentBalance: -9120, interestRate: 6.5, isManual: true, isAsset: false, isHidden: false, type: { name: 'loan', display: 'Loans' } },
	{
		id: 'acct-hsa',
		displayName: 'Fabrikam HSA',
		currentBalance: 1800,
		isAsset: true,
		isHidden: false,
		type: { name: 'brokerage', display: 'Investments' },
		subtype: { name: 'health_savings_account', display: 'Health Savings Account (HSA)' }
	},
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
	{ id: '9101', name: 'Paycheck', day: 1, amount: 3200, recurringType: 'income', accountId: 'acct-checking', category: CATEGORIES.paychecks },
	{ id: '9115', name: 'Paycheck', day: 15, amount: 3200, recurringType: 'income', accountId: 'acct-checking', category: CATEGORIES.paychecks }
];

interface TransactionTag {
	id: string;
	name: string;
	color: string;
}

/** A medical expense paid out of pocket and tagged to pay back from the HSA. */
interface HsaExpense {
	id: string;
	monthsAgo: number;
	amount: number;
	merchant: string;
	tag: 'toReimburse' | 'reimbursed';
	notes: string | null;
	hasReceipt: boolean;
}

const HSA_EXPENSES: HsaExpense[] = [
	{ id: 'tx-clinic', monthsAgo: 3, amount: -185.25, merchant: 'Fabrikam Clinic', tag: 'toReimburse', notes: null, hasReceipt: false },
	{ id: 'tx-dental', monthsAgo: 7, amount: -412.6, merchant: 'Contoso Dental', tag: 'toReimburse', notes: 'Crown, EOB claim 0001', hasReceipt: true },
	// Older than the year of transactions Wingspan reads for its other features.
	{ id: 'tx-pharmacy', monthsAgo: 20, amount: -42.1, merchant: 'Contoso Pharmacy', tag: 'reimbursed', notes: null, hasReceipt: true }
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
	private hsaTags: Record<HsaExpense['tag'], TransactionTag> | null = null;
	private hasLoanPayment = false;
	private hasHsaCardPurchase = false;
	private hasSavingsGoals = false;
	/** Payments planned on Pay down, by loan account id, when changed from the loan's $340. */
	private readonly plannedPayments = new Map<string, number>();
	/** What's planned for each savings goal a month, by goal id, from its linked account if it has one, or its general contribution. */
	private readonly goalPlannedAmounts = new Map([
		['goal-1', 250],
		['goal-2', 0],
		['goal-3', 900],
		['goal-4', 300]
	]);
	private hasRetirementGoal = false;
	private hasThirdPaycheckMonth = false;
	/** The synced order's splits, from `addSyncedOrder`, replaced when they're saved. */
	private orderSplits: { id: string; categoryId: string; amount: number; notes: string }[] | null = null;
	private savedSplitCount = 0;
	private isLoanPaymentLinked = false;
	private needsReviewCount = 0;
	private hasCardInterest = false;
	/** When the accounts that sync with a bank last synced: two hours ago, until Refresh all syncs them now. */
	private accountsSyncedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
	private readonly disconnectedAccountIds = new Set<string>();
	/** Accounts stuck at an older sync that Refresh all doesn't move, by account id. */
	private readonly stalledSyncedAt = new Map<string, string>();
	/** Loan balances entered through Monarch's account edit, by account id, as amounts owed. */
	private readonly enteredLoanBalances = new Map<string, number>();

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
		const loanPaymentLinks = { loanAccountIdByRecurrenceId: this.isLoanPaymentLinked ? { [AUTO_LOAN_GROUP_ID]: 'acct-loan' } : {} };
		return { recurring: { trackingSince: since, recurringItems }, recurringDueDates: { dueDatesByRecurrenceId: {} }, cashSettings: { cushion: 0 }, loanPaymentLinks };
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

	/** Pays the auto loan from checking two days ago, after its balance was last entered. Monarch ties the payment to its recurring expense Auto Loan. */
	public addLoanPayment(): void {
		this.hasLoanPayment = true;
	}

	/** Saves Monarch's Auto Loan expense as paying toward the auto loan, as choosing it under Pays toward does. */
	public linkLoanPayment(): void {
		this.isLoanPaymentLinked = true;
	}

	/** Marks the latest transactions as needing review in Monarch. */
	public markForReview(count: number): void {
		this.needsReviewCount = count;
	}

	/** Has the account's bank connection need signing in again, as Monarch shows on Accounts. */
	public disconnectAccount(accountId: string): void {
		this.disconnectedAccountIds.add(accountId);
	}

	/** Has the account last sync the given days ago and stay there, like a card that syncs only when its owner opens Monarch. */
	public stallAccountSync(accountId: string, daysAgo: number): void {
		this.stalledSyncedAt.set(accountId, new Date(Date.now() - daysAgo * 24 * 60 * 60_000).toISOString());
	}

	/** Charges the rewards card interest ten days ago, as when a statement wasn't paid in full. */
	public addCardInterest(): void {
		this.hasCardInterest = true;
	}

	/** Two savings goals on Goals: Rainy Day, with $250 a month planned, and a cruise with nothing planned yet. */
	public addSavingsGoals(): void {
		this.hasSavingsGoals = true;
	}

	/** Retirement goals: a 401(k) with $900 a month planned from the paycheck, and a Roth IRA with $300 from checking. */
	public addRetirementGoals(): void {
		this.hasRetirementGoal = true;
	}

	/** An order from Contoso Market, split by category by Monarch's retail sync, with its receipt's items in the notes. */
	public addSyncedOrder(): void {
		const notesOf = (lines: string[]) => [...lines, SYNCED_ORDER.link].join('\n\n');
		this.orderSplits = SYNCED_ORDER_SPLITS.map((split, index) => ({
			id: `tx-order-${index + 1}`,
			categoryId: split.categoryId,
			amount: split.amount,
			notes: notesOf(split.itemIndexes.map(itemIndex => SYNCED_ORDER.items[itemIndex]?.line ?? ''))
		}));
	}

	/** The synced order's splits, for checking what was saved. */
	public get syncedOrderSplits(): readonly { categoryId: string; amount: number; notes: string }[] {
		return this.orderSplits ?? [];
	}

	/** Budgets a third paycheck, $3,200 more pay, in one month of the year ahead. */
	public addThirdPaycheckMonth(): void {
		this.hasThirdPaycheckMonth = true;
	}

	/** A pharmacy purchase on the HSA's own card earlier this month. */
	public addHsaCardPurchase(): void {
		this.hasHsaCardPurchase = true;
	}

	/** Tags medical expenses paid from checking to pay back from the HSA, with tags named as given in Monarch's settings. */
	public addHsaExpenses({ toReimburseName = 'HSA – Reimburse', reimbursedName = 'HSA – Reimbursed' } = {}): void {
		this.hsaTags = {
			toReimburse: { id: 'tag-hsa-reimburse', name: toReimburseName, color: '#1baf7a' },
			reimbursed: { id: 'tag-hsa-reimbursed', name: reimbursedName, color: '#8e4ec6' }
		};
	}

	private savingsGoals() {
		const goals = this.hasRetirementGoal ? [...SAVINGS_GOALS, ...RETIREMENT_GOALS] : SAVINGS_GOALS;
		return goals.map(({ linkedAccountId, ...goal }) => {
			const linkedAccounts = [...this.baseAccounts, RETIREMENT_ACCOUNT].filter(account => account.id === linkedAccountId).map(account => ({ ...account, growthRate: GROWTH_RATES[account.id] }));
			const planned = this.goalPlannedAmounts.get(goal.id) ?? 0;
			return {
				...goal,
				targetDate: goal.targetDate && this.monthDay(-goal.targetDate, 28),
				progress: goal.currentBalance / goal.targetAmount,
				// Like Monarch's, only the general contribution, without what's planned from an account.
				plannedMonthlyContribution: linkedAccounts.length ? 0 : planned,
				linkedAccounts,
				allocationAmountsByAccount: linkedAccounts.map(account => ({ goalId: goal.id, account, totalAmount: goal.currentBalance })),
				monthlyBudgetAmounts: ({ startMonth, endMonth }: { startMonth: string; endMonth: string }) =>
					this.monthsBetween(String(startMonth), String(endMonth)).map(month => ({
						id: `${goal.id}-${month}`,
						month: `${month}-01`,
						plannedAmount: linkedAccounts.length ? 0 : planned,
						totalPlannedAmount: planned,
						actualAmount: 0,
						remainingAmount: linkedAccounts.length ? 0 : planned,
						accountBreakdown: linkedAccounts.map(account => ({ id: `${goal.id}-${account.id}-${month}`, account, plannedAmount: planned, actualAmount: 0, remainingAmount: planned }))
					}))
			};
		});
	}

	private get baseAccounts() {
		return this.hasBusiness ? [...BASE_ACCOUNTS, ...BUSINESS_ACCOUNTS] : BASE_ACCOUNTS;
	}

	private get monarchRecurring(): MonarchRecurring[] {
		const autoLoan: MonarchRecurring = {
			id: AUTO_LOAN_GROUP_ID,
			name: 'Auto Loan',
			day: this.dayOfMonth(this.loanPaymentDate),
			amount: -LOAN_PAYMENT,
			recurringType: 'expense',
			accountId: 'acct-checking',
			category: CATEGORIES.loanPayment,
			merchant: 'Fabrikam Auto Finance'
		};
		return [...MONARCH_RECURRING, ...(this.hasBusiness ? BUSINESS_RECURRING : []), ...(this.hasLoanPayment ? [autoLoan] : [])];
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
						.map((category, order) => ({ ...category, order, budgetVariability: BUDGET_VARIABILITY[category.id] ?? null }))
				})),
			// Monarch shows its business filter only on its Plus plan.
			subscription: () => ({ id: 'subscription-1', entitlements: this.hasPlus ? ['premium_plus'] : [], plusTrialEndsAt: null, canceledPlusTrialAt: null }),
			businessEntities: () => (this.hasBusiness ? [{ ...BUSINESS, icon: 'briefcase', structure: 'llc', accounts: BUSINESS_ACCOUNTS, accountsCount: 1, transactionsCount: 0 }] : []),
			// None belong to a business; otherwise the mock would fill the field with an empty business.
			accounts: () =>
				[...this.baseAccounts, ...this.wingspanAccounts.map(account => this.toMonarchAccount(account))].map(account => ({
					businessEntity: null,
					includeInNetWorth: !account.isHidden,
					includeBalanceInNetWorth: !account.isHidden,
					displayLastUpdatedAt: this.stalledSyncedAt.get(account.id) ?? this.accountsSyncedAt,
					credential: this.disconnectedAccountIds.has(account.id) ? { updateRequired: true, disconnectedFromDataProviderAt: null } : null,
					...account,
					...(this.enteredLoanBalances.has(account.id) ? { currentBalance: -(this.enteredLoanBalances.get(account.id) ?? 0) } : {}),
					...(account.type.name === 'loan' ? { signedBalance: ({ date }: { date: string }) => this.loanBalanceOn(date, account.currentBalance) } : {})
				})),
			snapshotsForAccount: ({ accountId }) => this.balanceSnapshots(String(accountId)),
			// Accounts groups its accounts by type, like Cash, Credit Cards and Loans.
			accountTypeSummaries: () =>
				[
					...Map.groupBy(
						this.baseAccounts.filter(account => !account.isHidden),
						account => account.type.name
					).values()
				].map(accounts => ({
					type: { ...accounts[0]?.type, group: accounts[0]?.isAsset ? 'asset' : 'liability' },
					accounts: accounts.map(account => ({
						businessEntity: null,
						credential: null,
						connectionStatus: null,
						includeInNetWorth: true,
						includeBalanceInNetWorth: true,
						displayLastUpdatedAt: this.now(),
						...account,
						displayBalance: Math.abs(account.currentBalance)
					})),
					isAsset: accounts[0]?.isAsset ?? true,
					isLiability: !accounts[0]?.isAsset,
					totalDisplayBalance: accounts.reduce((total, account) => total + Math.abs(account.currentBalance), 0)
				})),
			account: ({ id }) => {
				const stored = this.storedAccounts.find(account => account.id === id);
				return stored ? this.toMonarchAccount(stored) : (this.baseAccounts.find(account => account.id === id) ?? null);
			},
			// The list has the synced order's splits but not the charge they came from.
			getTransaction: ({ id }) => [...this.transactions(), ...this.syncedOrder().slice(0, 1)].find(transaction => transaction.id === id) ?? null,
			updateTransactionSplit: ({ input }) => {
				const { splitData } = input as { splitData: { id?: string; categoryId: string; amount: number; notes: string }[] };
				// Monarch saves notes with characters like "™" turned into "TM".
				this.orderSplits = splitData.map(split => ({
					id: split.id ?? `tx-order-new-${++this.savedSplitCount}`,
					categoryId: split.categoryId,
					amount: split.amount,
					notes: split.notes.normalize('NFKC')
				}));
				return { transaction: this.syncedOrder()[0] ?? null, errors: null };
			},
			categories: () =>
				Object.values(CATEGORIES).map((category, order) => ({ ...category, order, isDisabled: false, group: { ...category.group, order: [EXPENSES, INCOME, TRANSFERS].indexOf(category.group) } })),
			householdTransactionTags: () => (this.hsaTags ? [{ id: 'tag-retail', name: 'Retail Sync', color: '#f86713' }, ...Object.values(this.hsaTags)] : []),
			// A category's page lists that category's transactions.
			category: ({ id }) => Object.values(CATEGORIES).find(category => category.id === id) ?? null,
			allTransactions: ({ filters }) => {
				const { tags: tagIds, needsReview, categories: categoryIds } = (filters as { tags?: string[]; needsReview?: boolean; categories?: string[] } | null) ?? {};
				if (needsReview) return { totalCount: this.needsReviewCount, results: this.transactions().slice(0, this.needsReviewCount) };
				const tagged = tagIds?.length ? this.transactions().filter(transaction => transaction.tags.some(tag => tagIds.includes(tag.id))) : this.transactions();
				const results = categoryIds?.length ? tagged.filter(transaction => categoryIds.includes(transaction.category.id)) : tagged;
				return { totalCount: results.length, results };
			},
			savingsGoals: ({ ids }) => (this.hasSavingsGoals ? this.savingsGoals().filter(goal => !(ids as string[] | null)?.length || (ids as string[]).includes(goal.id)) : []),
			setSavingsGoalBudgetAmount: ({ input }) => {
				const { savingsGoalId, amount } = input as { savingsGoalId: string; amount: number };
				this.goalPlannedAmounts.set(savingsGoalId, amount);
				return { success: true, errors: null };
			},
			// Pay down lists the household's loans, each paid $340 a month.
			debtAccounts: () =>
				this.baseAccounts
					.filter(account => account.type.name === 'loan')
					.map(account => ({ ...account, plannedPayment: this.plannedPayments.get(account.id) ?? LOAN_PAYMENT, minimumPayment: LOAN_PAYMENT, excludeFromDebtPaydown: false })),
			budgetStatus: () => ({ hasBudget: true, hasTransactions: true, willCreateBudgetFromEmptyDefaultCategories: false }),
			budgetData: ({ startMonth, endMonth }) => this.budgetData(String(startMonth), String(endMonth)),
			savingsGoalMonthlyBudgetAmounts: ({ startMonth, endMonth }) => [
				{
					id: 'goal-amounts-1',
					savingsGoal: { id: 'goal-1', name: 'Rainy Day', archivedAt: null },
					monthlyAmounts: this.monthsBetween(String(startMonth), String(endMonth)).map(month => ({
						id: `goal-1-${month}`,
						month: `${month}-01`,
						plannedAmount: this.goalPlannedAmounts.get('goal-1') ?? 0,
						remainingAmount: (this.goalPlannedAmounts.get('goal-1') ?? 0) - (month === this.today.slice(0, 7) ? 100 : 0)
					}))
				}
			],
			aggregates: ({ filters, groupBy }) => this.aggregates(filters as AggregateFilters | null, (groupBy as string[] | null) ?? []),
			recurrenceGroupsForPeriod: ({ startDate, endDate }) => this.recurrenceRows(String(startDate ?? this.today), String(endDate ?? startDate ?? this.today)),
			recurrenceGroup: ({ id }) => this.recurrenceRows(this.today, this.today).find(row => row.recurrenceGroup.id === id)?.recurrenceGroup ?? null,
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
			forceRefreshAllAccounts: () => {
				this.accountsSyncedAt = this.now();
				return { success: true, forceRefreshOperationId: 'refresh-1', errors: null };
			},
			forceRefreshOperation: () => ({ state: 'COMPLETED' }),
			createManualAccount: ({ input }) => {
				const { name } = input as { name: string };
				const account: StoredAccount = { id: `acct-manual-${this.storedAccounts.length + 1}`, displayName: name, isHidden: false, notes: null, updatedAt: this.now(), deletedAt: null };
				this.storedAccounts.push(account);
				return { account: this.toMonarchAccount(account), errors: null };
			},
			updateAccount: ({ input }) => {
				const { id, notes, hideFromList, name, displayBalance, plannedPayment } = input as {
					id: string;
					notes?: string;
					hideFromList?: boolean;
					name?: string;
					displayBalance?: number;
					plannedPayment?: number;
				};
				const baseAccount = this.baseAccounts.find(candidate => candidate.id === id);
				if (baseAccount && plannedPayment !== undefined) {
					this.plannedPayments.set(id, plannedPayment);
					return { account: baseAccount, errors: null };
				}
				if (baseAccount && displayBalance !== undefined) {
					this.enteredLoanBalances.set(id, displayBalance);
					return { account: baseAccount, errors: null };
				}
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

	/** What's budgeted for a category in a month, with the third paycheck's month budgeting half again as much pay. */
	private plannedBudget(categoryId: string, month: string): number {
		const planned = BUDGET_PLANNED[categoryId] ?? 0;
		const isThirdPaycheckMonth = this.hasThirdPaycheckMonth && categoryId === 'cat-paychecks' && month === this.addMonths(this.today.slice(0, 7), THIRD_PAYCHECK_MONTHS_AHEAD);
		return isThirdPaycheckMonth ? planned * 1.5 : planned;
	}

	/** Monarch's budget for each month: what's planned per category, and what was spent or earned. */
	private budgetData(startMonth: string, endMonth: string) {
		const months = this.monthsBetween(startMonth, endMonth);
		const budgeted = Object.values(CATEGORIES).filter(category => category.group.type !== 'transfer');
		const actualOf = (categoryId: string, month: string) => {
			const sum = this.transactions()
				.filter(transaction => transaction.category.id === categoryId && transaction.date.startsWith(month))
				.reduce((total, transaction) => total + transaction.amount, 0);
			return Math.abs(sum);
		};
		const amountsOf = (planned: number, actual: number, month: string) => ({
			month: `${month}-01`,
			plannedCashFlowAmount: planned,
			plannedSetAsideAmount: 0,
			actualAmount: actual,
			remainingAmount: planned - actual,
			previousMonthRolloverAmount: null,
			rolloverType: null,
			cumulativeActualAmount: null,
			rolloverTargetAmount: null
		});
		const totalsOf = (categories: typeof budgeted, month: string) => {
			const planned = categories.reduce((total, category) => total + this.plannedBudget(category.id, month), 0);
			const actual = categories.reduce((total, category) => total + actualOf(category.id, month), 0);
			return { plannedAmount: planned, actualAmount: actual, remainingAmount: planned - actual, previousMonthRolloverAmount: 0 };
		};
		const expenses = budgeted.filter(category => category.group.type === 'expense');
		const byVariability = (variability: string) => expenses.filter(category => BUDGET_VARIABILITY[category.id] === variability);
		return {
			monthlyAmountsByCategory: budgeted.map(category => ({
				category: { ...category, budgetVariability: BUDGET_VARIABILITY[category.id] ?? null },
				monthlyAmounts: months.map(month => amountsOf(this.plannedBudget(category.id, month), actualOf(category.id, month), month))
			})),
			monthlyAmountsByCategoryGroup: [],
			monthlyAmountsForFlexExpense: {
				budgetVariability: 'flexible',
				monthlyAmounts: months.map(month => {
					const totals = totalsOf(byVariability('flexible'), month);
					return amountsOf(totals.plannedAmount, totals.actualAmount, month);
				})
			},
			totalsByMonth: months.map(month => ({
				month: `${month}-01`,
				totalIncome: totalsOf(
					budgeted.filter(category => category.group.type === 'income'),
					month
				),
				totalExpenses: totalsOf(expenses, month),
				totalFixedExpenses: totalsOf(byVariability('fixed'), month),
				totalFlexibleExpenses: totalsOf(byVariability('flexible'), month),
				totalNonMonthlyExpenses: totalsOf(byVariability('non_monthly'), month)
			}))
		};
	}

	private seenProfile() {
		const seenAt = new Date().toISOString();
		return {
			id: 'profile-1',
			dismissedRecurringV2WalkthroughAt: seenAt,
			dismissedRecurringWalkthroughAt: seenAt,
			dismissedOwnershipWalkthroughAt: seenAt,
			hasSeenCategoriesManagementTour: true,
			hasDismissedWhatsNewAt: seenAt
		};
	}

	private toMonarchAccount(account: StoredAccount) {
		return { ...account, currentBalance: 0, isAsset: true, type: { name: 'other_asset', display: 'Other' } };
	}

	private recurrenceRows(startDate: string, endDate: string) {
		const transactionsByGroupId = Map.groupBy(
			this.transactions().filter(transaction => 'recurrenceGroup' in transaction && transaction.recurrenceGroup),
			transaction => ('recurrenceGroup' in transaction ? transaction.recurrenceGroup?.id : undefined)
		);
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
						transactions: transactionsByGroupId.get(recurring.id) ?? [],
						account,
						category: recurring.category,
						merchant: { id: `merchant-${recurring.merchant ?? recurring.id}`, name: recurring.merchant ?? recurring.name, logoUrl: null }
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

	/** Cash Flow's totals: one row for the range, or one per combination of category, month, quarter and year asked for. Grouping by group or merchant returns nothing. */
	private aggregates(filters: AggregateFilters | null, groupBy: string[]) {
		const startDate = filters?.startDate ?? '0000-01-01';
		const endDate = filters?.endDate ?? this.today;
		const { categories, accounts, excludeAccounts, tags } = filters ?? {};
		const inRange = this.transactions().filter(
			transaction =>
				transaction.date >= startDate &&
				transaction.date <= endDate &&
				transaction.category.group.type !== 'transfer' &&
				(!categories?.length || categories.includes(transaction.category.id)) &&
				(!accounts?.length || accounts.includes(transaction.account?.id ?? '')) &&
				!excludeAccounts?.includes(transaction.account?.id ?? '') &&
				(!tags?.length || transaction.tags.some(tag => tags.includes(tag.id)))
		);
		const summaryOf = (transactions: typeof inRange) => {
			const sumIncome = transactions.filter(transaction => transaction.amount > 0).reduce((total, transaction) => total + transaction.amount, 0);
			const sumExpense = transactions.filter(transaction => transaction.amount < 0).reduce((total, transaction) => total + transaction.amount, 0);
			const savings = sumIncome + sumExpense;
			const dates = transactions.map(transaction => transaction.date).sort();
			const amounts = transactions.map(transaction => Math.abs(transaction.amount));
			return {
				sum: savings,
				sumIncome,
				sumExpense,
				savings,
				savingsRate: sumIncome ? savings / sumIncome : 0,
				count: transactions.length,
				avg: amounts.length ? amounts.reduce((total, amount) => total + amount, 0) / amounts.length : null,
				max: amounts.length ? Math.max(...amounts) : null,
				first: dates[0] ?? null,
				last: dates.at(-1) ?? null
			};
		};

		type Transaction = (typeof inRange)[number];
		const quarterStart = (date: string) => `${date.slice(0, 5)}${String(Math.floor((Number(date.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
		const groupValues: Record<string, (transaction: Transaction) => unknown> = {
			category: transaction => transaction.category,
			month: transaction => `${transaction.date.slice(0, 7)}-01`,
			quarter: transaction => quarterStart(transaction.date),
			year: transaction => `${transaction.date.slice(0, 4)}-01-01`
		};
		if (!groupBy.length) return [{ groupBy: {}, summary: summaryOf(inRange) }];
		// Grouping by anything else, like merchant, returns nothing.
		if (groupBy.some(key => !groupValues[key])) return [];
		const groupOf = (transaction: Transaction) => Object.fromEntries(groupBy.map(key => [key, groupValues[key]?.(transaction)]));
		const keyOf = (group: Record<string, unknown>) => JSON.stringify(Object.values(group).map(value => (value as { id?: string } | null)?.id ?? value));
		return [...Map.groupBy(inRange, transaction => keyOf(groupOf(transaction))).entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, transactions]) => ({ groupBy: groupOf(transactions[0] as Transaction), summary: summaryOf(transactions) }));
	}

	/** The synced order's charge, then its splits, each pointing back to it. */
	private syncedOrder() {
		if (!this.orderSplits) return [];
		const categoryOf = (categoryId: string) => Object.values(CATEGORIES).find(category => category.id === categoryId) ?? CATEGORIES.groceries;
		const base = {
			date: this.dayOffset(-3),
			pending: false,
			plaidName: 'CONTOSO MARKET ONLINE',
			merchant: { id: 'merchant-contoso-market', name: SYNCED_ORDER.merchant, logoUrl: null },
			account: BASE_ACCOUNTS.find(account => account.id === 'acct-rewards'),
			tags: [] as TransactionTag[],
			attachments: [] as { id: string }[]
		};
		const original = {
			...base,
			id: SYNCED_ORDER.id,
			amount: SYNCED_ORDER.amount,
			category: CATEGORIES.groceries,
			notes: [...SYNCED_ORDER.items.map(item => item.line), SYNCED_ORDER.link].join('\n\n'),
			hasSplitTransactions: true,
			splitTransactions: [] as unknown[]
		};
		const splits = this.orderSplits.map(split => ({
			...base,
			id: split.id,
			amount: split.amount,
			category: categoryOf(split.categoryId),
			notes: split.notes,
			isSplitTransaction: true,
			originalTransaction: original
		}));
		original.splitTransactions = splits;
		return [original, ...splits];
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
			account: BASE_ACCOUNTS.find(account => account.id === accountId),
			tags: [] as TransactionTag[],
			notes: null as string | null,
			attachments: [] as { id: string }[]
		});
		const hsaTags = this.hsaTags;
		const hsaExpenses = hsaTags
			? HSA_EXPENSES.map(expense => ({
					...transaction(expense.id, this.monthDay(expense.monthsAgo, 10), expense.amount, expense.merchant.toUpperCase(), expense.merchant, 'acct-checking', CATEGORIES.medical),
					tags: [hsaTags[expense.tag]],
					notes: expense.notes,
					attachments: expense.hasReceipt ? [{ id: `attachment-${expense.id}` }] : []
				}))
			: [];
		return [
			...this.syncedOrder().slice(1),
			...hsaExpenses,
			...(this.hasHsaCardPurchase ? [transaction('tx-hsa-card', this.monthDay(0, 1), -64.3, 'FABRIKAM PHARMACY', 'Fabrikam Pharmacy', 'acct-hsa', CATEGORIES.medical)] : []),
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
			...(this.hasCardInterest ? [transaction('tx-rewards-interest', this.dayOffset(-10), -7.88, 'INTEREST CHARGE ON PURCHASES', 'Rewards Bank', 'acct-rewards', CATEGORIES.groceries)] : []),
			...(this.hasLoanPayment
				? [
						{
							...transaction('tx-auto-loan', this.loanPaymentDate, -LOAN_PAYMENT, 'FABRIKAM AUTO LOAN PMT', 'Fabrikam Auto Finance', 'acct-checking', CATEGORIES.loanPayment),
							recurrenceGroup: { id: AUTO_LOAN_GROUP_ID }
						}
					]
				: []),
			// Everyday spending: groceries on the rewards card, gas from checking.
			...[1, 2, 3, 4, 5, 6].map(monthsAgo =>
				transaction(`tx-grocer-${monthsAgo}`, this.monthDay(monthsAgo, 8), -(300 + monthsAgo * 10), 'GREEN GROCER', 'Green Grocer', 'acct-rewards', CATEGORIES.groceries)
			),
			transaction('tx-grocer-0', this.today, -45, 'GREEN GROCER', 'Green Grocer', 'acct-rewards', CATEGORIES.groceries),
			...[1, 2, 3, 4, 5, 6].map(monthsAgo => transaction(`tx-gas-${monthsAgo}`, this.monthDay(monthsAgo, 12), -60, 'FUEL STOP', 'Fuel Stop', 'acct-checking', CATEGORIES.gas)),
			// Client payouts land in checking about weekly, in amounts that vary. Monarch has no recurring item for them.
			...Array.from({ length: 12 }, (_, weeksAgo) =>
				transaction(`tx-payout-${weeksAgo}`, this.dayOffset(-7 * weeksAgo - 1), 145 + (weeksAgo % 3) * 145, 'FABRIKAM TRANSFER', 'Fabrikam Payouts', 'acct-checking', CATEGORIES.clientPayments)
			),
			// Paychecks are deposited to checking; Monarch ties each to its recurring item.
			...[1, 2, 3, 4, 5, 6].flatMap(monthsAgo =>
				[1, 15].map(day => ({
					...transaction(`tx-pay-${monthsAgo}-${day}`, this.monthDay(monthsAgo, day), 3200, 'EMPLOYER PAYROLL', 'Employer', 'acct-checking', CATEGORIES.paychecks),
					recurrenceGroup: { id: String(9100 + day) }
				}))
			)
		];
	}

	/** A manual loan's balance for each of the last 40 days, as Monarch keeps it: last entered five days ago, or today once entered again. */
	private balanceSnapshots(accountId: string) {
		const account = this.baseAccounts.find(candidate => candidate.id === accountId);
		if (!account || account.currentBalance === null) return [];
		const entered = this.enteredLoanBalances.get(accountId);
		return Array.from({ length: LOAN_SNAPSHOT_DAYS + 1 }, (_, index) => {
			const date = this.dayOffset(index - LOAN_SNAPSHOT_DAYS);
			if (entered !== undefined && date === this.today) return { date, signedBalance: -entered };
			return { date, signedBalance: date < this.dayOffset(-LOAN_ENTERED_DAYS_AGO) ? account.currentBalance - LOAN_PAYMENT : account.currentBalance };
		});
	}

	private get loanPaymentDate(): string {
		return this.dayOffset(-2);
	}

	private dayOfMonth(date: string): number {
		return Number(date.slice(8, 10));
	}

	/** The auto loan's month-end balances, for Loans paid down: $340 lower each month, so it owed that much more for each month before this one. */
	private loanBalanceOn(date: string, currentBalance: number): number {
		return currentBalance - LOAN_PAYMENT * (this.monthsBetween(date, this.today).length - 1);
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
