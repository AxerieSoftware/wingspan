import { expect, itemRow, section, test } from './fixtures';

test('the all view shows last and next dates, due by day of the month', async ({ page, open }) => {
	await open({ path: '/recurring-v2/all' });
	const lessons = itemRow(section(page, 'Expenses'), 'Piano Lessons');
	await expect(lessons).toContainText('Due the 1st');
	await expect(lessons).toContainText(/Paid \w{3} \d{1,2}/);
	await expect(section(page, 'Expenses').getByRole('button', { name: 'Internet' })).toContainText('Due the 30th');
});

test("Wingspan doesn't change the calendar view", async ({ page, open }) => {
	await open();
	await page.getByRole('tab', { name: 'Calendar' }).click();
	await expect(page.locator('[data-wingspan-row], [data-wingspan-statements], [data-wingspan-section]')).toHaveCount(0);
	await page.getByRole('tab', { name: 'Monthly' }).click();
	await expect(itemRow(page, 'Piano Lessons')).toBeVisible();
});

test("doesn't change other pages", async ({ page, open }) => {
	await open();
	await page.getByRole('link', { name: 'Dashboard' }).click();
	await expect(page.locator('[data-wingspan-row]')).toHaveCount(0);
});
