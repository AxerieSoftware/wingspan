import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const planner = (page: Page) => page.getByRole('group', { name: 'Goal planner' });
const goals = (page: Page) => planner(page).getByRole('list', { name: 'Goals and debts' }).getByRole('listitem');
/** A goal's row, found by the button with its name, since another row's "When done" can name it too. */
const row = (page: Page, name: string) => goals(page).filter({ has: page.getByRole('button', { name: new RegExp(`^${name}`) }) });
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

/** The room shown on that stat, in whole dollars. */
async function roomOf(page: Page, label: string) {
	const stat = planner(page).getByRole('button', { name: new RegExp(label) });
	await expect(stat).toContainText(/a month/);
	return Number((await stat.textContent())?.replace(/a month.*/, '').replace(/[^\d-]/g, ''));
}

async function setExtra(page: Page, name: string, amount: string) {
	const input = planner(page).getByRole('textbox', { name: `${name}, extra a month` });
	await input.fill(amount);
	// Blurring rather than tabbing, since tabbing onto the next goal selects it for the chart.
	await input.blur();
}

test('the Goal planner sits under Save up with the room for goals and each goal and debt at its monthly amount', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await expect(page.locator('[data-external-id="goals-table-sections"] > [data-mds="card"] + [data-wingspan-goal-planner]')).toHaveCount(1);
	await expect(planner(page).getByText('Room by typical spending')).toBeVisible();
	await expect(planner(page).getByText('Room by your budget')).toBeVisible();
	await expect(goals(page)).toHaveCount(3);
	await expect(row(page, 'Rainy Day')).toContainText('Save up · $4,800 to go$250');
	await expect(row(page, 'Contoso Cruise')).toContainText('Nothing planned');
	await expect(row(page, 'Auto Loan')).toContainText(/Pay down · 6\.5% · \$9,120 owed.*\$[\d,]+ interest/);
});

test('an extra amount for a goal shows when it finishes against its target, and comes out of the room both ways', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	const typical = await roomOf(page, 'Room by typical spending');
	// Every month of the budget plans $6,400 of income and $1,930 of expenses, and $250 goes to Rainy Day.
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).toContainText('$4,220 a month');

	await setExtra(page, 'Contoso Cruise', '200');

	await expect(row(page, 'Contoso Cruise')).toContainText('(was Nothing planned)');
	await expect(row(page, 'Contoso Cruise')).toContainText(/By its \w{3} \d{4} target/);
	await expect(planner(page).getByRole('status')).toHaveText('$200 a monthExtra toward goals');
	await expect(planner(page).getByRole('button', { name: /Room by typical spending/ })).toContainText(`${money(typical - 200)} left after extras`);
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).toContainText('$4,020 left after extras');
	await expect(planner(page).getByRole('img', { name: /Contoso Cruise: saved by month/ })).toBeVisible();
});

test('a change to one income, like a raise, or to other income adds to the room both ways', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	const typical = await roomOf(page, 'Room by typical spending');
	const incomes = planner(page).getByRole('list', { name: 'Income' }).getByRole('listitem');
	await expect(incomes.last()).toContainText('Other income');
	const firstIncome = (await incomes.first().locator('span').first().textContent()) ?? '';

	for (const [name, change] of [
		[firstIncome, '500'],
		['Other income', '300']
	]) {
		const input = planner(page).getByRole('textbox', { name: `${name}, change a month` });
		await input.fill(change ?? '');
		await input.blur();
	}

	await expect(planner(page).getByRole('button', { name: /Room by typical spending/ })).toContainText(`${money(typical + 800)} a month`);
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).toContainText('$5,020 a month');
});

test('moving money from one goal to a debt pays the debt off sooner, with less interest, charts its burn-down, and leaves the room as it was', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await setExtra(page, 'Rainy Day', '-100');
	await setExtra(page, 'Auto Loan', '100');

	await expect(row(page, 'Auto Loan')).toContainText(/\(was \w{3} \d{4}\)/);
	await expect(row(page, 'Auto Loan')).toContainText(/\$[\d,]+ interest · \$[\d,]+ saved vs\. minimum/);
	await expect(planner(page).getByRole('img', { name: /Auto Loan: owed by month, from \$9,120 down to \$0/ })).toBeVisible();
	await expect(planner(page).getByRole('status')).toHaveCount(0);
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).not.toContainText('after extras');

	await planner(page).getByRole('button', { name: 'Reset' }).click();
	await expect(planner(page).getByRole('textbox', { name: 'Auto Loan, extra a month' })).toHaveValue('');
});

test("Pay down keeps Monarch's own payoff view, without the planner", async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/debt-paydown', waitForRows: false });
	await expect(page.getByText('Debt Free Date')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('[data-wingspan-goal-planner]')).toHaveCount(0);
});

test("pointing a finished goal's money at another goal rolls it over once the first is done, and stays chosen", async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	await expect(row(page, 'Contoso Cruise')).toContainText('Nothing planned');

	await planner(page).getByRole('combobox', { name: 'Rainy Day, when done, its money goes to' }).click();
	await page.getByRole('option', { name: 'Contoso Cruise' }).click();

	// Rainy Day's $250 a month moves to the cruise once Rainy Day reaches $6,000.
	await expect(row(page, 'Contoso Cruise')).toContainText(/^Contoso Cruise.*\$0Nowhere\w{3} \d{4}/);
	await planner(page).getByRole('button', { name: 'Contoso Cruise Save up · $2,600 to go' }).click();
	await expect(planner(page).getByRole('img', { name: /Contoso Cruise: saved by month toward \$3,000/ })).toBeVisible();

	await page.reload();
	await expect(planner(page).getByRole('combobox', { name: 'Rainy Day, when done, its money goes to' })).toHaveText('Contoso Cruise');
	await expect(row(page, 'Contoso Cruise')).not.toContainText('Nothing planned');
});

test('one chart shows every goal and debt, with the selected one on top', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await setExtra(page, 'Contoso Cruise', '200');
	await planner(page)
		.getByRole('button', { name: /^Auto Loan/ })
		.click();

	const chart = planner(page).getByRole('img', { name: /^Every goal and debt by month.*Auto Loan: owed by month/ });
	await expect(chart).toBeVisible();
	for (const name of ['Rainy Day', 'Contoso Cruise', 'Auto Loan']) await expect(planner(page).getByText(name, { exact: true }).last()).toBeVisible();
	await expect(chart.locator('polyline')).toHaveCount(4);
});

test("hovering the chart shows each goal's amount that month", async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	await planner(page)
		.getByRole('button', { name: /^Auto Loan/ })
		.click();

	await planner(page)
		.getByRole('img', { name: /^Every goal and debt by month/ })
		.hover();

	const tooltip = planner(page).getByRole('tooltip');
	await expect(tooltip).toContainText(/^\w{3} \d{4}Auto Loan\$[\d,]+\.\d{2}Auto Loan without the extra\$[\d,]+\.\d{2}Rainy Day\$[\d,]+\.\d{2}/);
});

test('a goal held in a growing account grows, and a goal with a target date shows what it needs a month to get there', async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	await expect(row(page, 'Contoso Cruise')).toContainText('Save up · $2,600 to go · 4% growth');

	await row(page, 'Contoso Cruise')
		.getByRole('button', { name: /^Needs \$[\d,]+ a month for its \w{3} \d{4} target$/ })
		.click();

	await expect(planner(page).getByRole('textbox', { name: 'Contoso Cruise, extra a month' })).not.toHaveValue('');
	await expect(row(page, 'Contoso Cruise')).toContainText(/By its \w{3} \d{4} target/);
});

test("saving puts the goals' and debts' new amounts in Monarch and shows them as what goes toward each now", async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await setExtra(page, 'Rainy Day', '50');
	await setExtra(page, 'Contoso Cruise', '120');
	await setExtra(page, 'Auto Loan', '25');
	await planner(page).getByRole('button', { name: 'Save to goals' }).click();

	await expect(planner(page)).toContainText('Saved 3 new monthly amounts to Monarch.');
	await expect(row(page, 'Rainy Day')).toContainText('$300');
	// The cruise's money comes from its linked account, which Monarch's plannedMonthlyContribution leaves out.
	await expect(row(page, 'Contoso Cruise')).toContainText('$120');
	await expect(row(page, 'Auto Loan')).toContainText('$365$25 over minimum');
	for (const name of ['Rainy Day', 'Contoso Cruise', 'Auto Loan']) await expect(planner(page).getByRole('textbox', { name: `${name}, extra a month` })).toHaveValue('');
	// The goals' $420 comes out of the budget's room. The loan's $25 doesn't, since a budget has extra payments as an expense.
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).toContainText('$4,050 a month');
});

test("a retirement goal paid from the paycheck, like a 401(k), doesn't come out of the room, but one paid from checking does", async ({ page, household, open }) => {
	household.addSavingsGoals();
	household.addRetirementGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await expect(row(page, 'Retirement – 401\\(k\\)')).toContainText('$900');
	// $4,220 less the Roth IRA's $300, with nothing taken for the 401(k)'s $900.
	await expect(planner(page).getByRole('button', { name: /Room by your budget/ })).toContainText('$3,920 a month');
});

test('goals named alike, like "Retirement – 401(k)" and "Retirement – Roth IRA", are also added up on the chart', async ({ page, household, open }) => {
	household.addSavingsGoals();
	household.addRetirementGoals();
	await open({ path: '/goals/savings', waitForRows: false });

	await expect(planner(page).getByText('Retirement, all')).toBeVisible();
	await planner(page)
		.getByRole('img', { name: /^Every goal and debt by month/ })
		.hover({ position: { x: 80, y: 100 } });

	await expect(planner(page).getByRole('tooltip')).toContainText(/Retirement, all\$5\d,\d{3}\.\d{2}/);
});

test("each row's extra can be cleared on its own", async ({ page, household, open }) => {
	household.addSavingsGoals();
	await open({ path: '/goals/savings', waitForRows: false });
	await setExtra(page, 'Rainy Day', '50');
	await setExtra(page, 'Auto Loan', '25');

	await planner(page).getByRole('button', { name: "Clear Rainy Day's extra" }).click();

	await expect(planner(page).getByRole('textbox', { name: 'Rainy Day, extra a month' })).toHaveValue('');
	await expect(planner(page).getByRole('textbox', { name: 'Auto Loan, extra a month' })).not.toHaveValue('');
	await expect(planner(page).getByRole('button', { name: "Clear Rainy Day's extra" })).toHaveCount(0);
});

test("a month budgeting a third paycheck doesn't count in a normal month's room, but shows on its own", async ({ page, household, open }) => {
	household.addSavingsGoals();
	household.addThirdPaycheckMonth();
	await open({ path: '/goals/savings', waitForRows: false });

	const budgetRoom = planner(page).getByRole('button', { name: /Room by your budget/ });
	await expect(budgetRoom).toContainText('$4,220 a month');
	await expect(budgetRoom).toContainText('Plus about $3,200 more in a month with an extra paycheck');
});
