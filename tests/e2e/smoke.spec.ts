import { expect, itemRow, test } from './fixtures';

// Runs in every browser project, so it seeds Wingspan's data through Monarch rather than the extension's storage.

test("items saved in Monarch load and show on Monarch's Recurring page", async ({ page, open, household }) => {
	household.seedWingspanAccount(household.sampleItems());
	await open({ withSampleItems: false });
	await expect(itemRow(page, 'Piano Lessons')).toBeVisible();
	await expect(page.getByText("Couldn't load Wingspan's data")).toBeHidden();
});

test('a change to an item saves back to Monarch', async ({ page, open, household }) => {
	household.seedWingspanAccount(household.sampleItems());
	await open({ withSampleItems: false });
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await details.getByRole('button', { name: 'Due day' }).click();
	await page.getByRole('radio', { name: '5th of the month', exact: true }).click();
	await expect(itemRow(page, 'Piano Lessons')).toContainText(/Due \w{3} 5/);
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('BYMONTHDAY=5');
});
