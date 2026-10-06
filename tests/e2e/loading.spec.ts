import { APP, type ApiBehavior, expect, itemRow, seedSampleItems, test } from './fixtures';

test.beforeEach(async ({ page, household }) => {
	await seedSampleItems(page, household);
});

/** Holds Wingspan's requests until the returned function is called. */
function holdRequests(api: ApiBehavior): () => void {
	let release = () => {};
	api.held = new Promise(resolve => {
		release = resolve;
	});
	return release;
}

test("rows show a loading shimmer until Monarch's data arrives, then fill in", async ({ page, api }) => {
	const release = holdRequests(api);
	await page.goto(`${APP}/recurring-v2/monthly`);
	const row = itemRow(page, 'Piano Lessons');
	await expect(row).toBeVisible();
	await expect(row.locator('[data-mds="skeleton-text"], [data-mds="skeleton"]').first()).toBeVisible();
	await expect(row).toContainText('Piano Lessons');
	release();
	await expect(row.locator('[data-mds^="skeleton"]')).toHaveCount(0, { timeout: 15_000 });
	await expect(row).toContainText(/\$280\.00/);
});

test("the summary and a row's details shimmer while loading", async ({ page, api }) => {
	const release = holdRequests(api);
	await page.goto(`${APP}/recurring-v2/monthly`);
	await expect(page.locator('[data-wingspan-summary-statements] [data-mds="skeleton-text"]').first()).toBeVisible();
	await itemRow(page, 'Piano Lessons').click();
	const details = page.getByRole('region', { name: 'Piano Lessons details' });
	await expect(details.locator('[data-mds="skeleton"]').first()).toBeVisible();
	await expect(details.getByText('Amount history')).toBeVisible();
	release();
	await expect(details.locator('[data-mds^="skeleton"]')).toHaveCount(0, { timeout: 15_000 });
	await expect(page.locator('[data-wingspan-summary-statements]')).toContainText('Free cash today');
});

test('Save shows a spinner while it waits for Monarch', async ({ page, api }) => {
	await page.goto(`${APP}/recurring-v2/monthly`);
	await expect(itemRow(page, 'Piano Lessons').locator('[data-mds^="skeleton"]')).toHaveCount(0, { timeout: 20_000 });
	await itemRow(page, 'Piano Lessons').getByRole('button', { name: 'More options' }).click();
	await page.getByRole('menuitem', { name: 'Edit' }).click();
	const editor = page.getByRole('dialog', { name: 'Edit Piano Lessons' });
	await editor.getByRole('textbox', { name: 'Name and icon' }).fill('Piano Lessons!');
	const release = holdRequests(api);
	await editor.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(editor.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-busy', 'true');
	release();
	await expect(editor).toBeHidden({ timeout: 30_000 });
	await expect(itemRow(page, 'Piano Lessons!')).toBeVisible();
});
