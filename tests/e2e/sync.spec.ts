import { APP, expect, inContentScript, itemRow, section, seedExtensionStorage, storageKey, test } from './fixtures';

test('existing items move into a hidden Wingspan account in Monarch, with a notice', async ({ page, open, household }) => {
	await open();
	await expect(page.getByText('Wingspan now saves to your Monarch account, in a hidden account named wingspan.')).toBeVisible();
	const [account] = household.wingspanAccounts;
	expect(account).toMatchObject({ displayName: 'wingspan', isHidden: true });
	const json = JSON.parse(account?.notes?.slice(account.notes.indexOf('{')) ?? '{}');
	expect(json.version).toBe(1);
	expect(json.value.recurring.recurringItems.map((item: { name: string }) => item.name)).toContain('Piano Lessons');
});

test('items saved by another browser load from Monarch', async ({ page, open, household }) => {
	household.seedWingspanAccount(household.otherBrowserItems());
	await open({ withSampleItems: false });
	await expect(itemRow(section(page, 'Expenses'), 'Gym')).toBeVisible();
});

test('saved items load from Monarch after a reload', async ({ page, open }) => {
	await open();
	// With no local cache, as in a new browser, the items load from Monarch.
	await inContentScript(page, `chrome.storage.local.remove(${JSON.stringify(storageKey('wingspan'))})`);
	await page.goto(`${APP}/recurring-v2/monthly`);
	await expect(itemRow(section(page, 'Expenses'), 'Piano Lessons')).toBeVisible();
});

test("a browser with local items merges them in when it first finds the household's account", async ({ page, open, household }) => {
	household.seedWingspanAccount(household.otherBrowserItems());
	await open();
	await expect(itemRow(section(page, 'Expenses'), 'Gym')).toBeVisible();
	await expect(itemRow(section(page, 'Expenses'), 'Piano Lessons')).toBeVisible();
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('Piano Lessons');
});

test("when the account is removed from Monarch, the next load recreates it from this browser's cache", async ({ page, open, household }) => {
	await open();
	await expect.poll(() => household.wingspanAccounts.length).toBe(1);
	household.deleteWingspanAccounts();
	await page.goto(`${APP}/recurring-v2/monthly`);
	await expect(itemRow(page, 'Piano Lessons')).toBeVisible();
	await expect.poll(() => household.wingspanAccounts[0]?.notes).toContain('Piano Lessons');
});

test('a notice closes with its Dismiss button', async ({ page, open }) => {
	await open();
	const notice = page.getByText('Wingspan now saves to your Monarch account');
	await expect(notice).toBeVisible();
	await page.getByRole('button', { name: 'Dismiss' }).click();
	await expect(notice).toHaveCount(0);
});

test("when Monarch can't be reached, a notice shows and closes once Monarch is reachable again", async ({ page, open, api }) => {
	api.failure = 'network';
	await open({ waitForRows: false });
	const failure = page.getByText("Couldn't load from Monarch. Monarch couldn't be reached. Showing what's saved in this browser.");
	await expect(failure).toBeVisible();
	await expect(page.getByRole('button', { name: 'Details' })).toHaveCount(0);

	api.failure = null;
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect(failure).toHaveCount(0);
});

test('when the user is signed out of Monarch, the notice says to sign in again', async ({ page, open, api }) => {
	api.failure = 401;
	await open({ waitForRows: false });
	await expect(page.getByText("Couldn't load from Monarch. Monarch signed you out. Sign in again.", { exact: false })).toBeVisible();
});

test('when Monarch rejects every request, Wingspan retries a few times and then stops, no matter how the page changes', async ({ page, open, api, apiLog }) => {
	api.failure = 401;
	await open({ waitForRows: false });
	for (let click = 0; click < 10; click++) {
		await page.getByRole('heading', { level: 1 }).click();
		await page.waitForTimeout(300);
	}

	const wingspanRequests = apiLog.operations.filter(operation => operation.startsWith('wingspan_'));
	expect(wingspanRequests.length).toBeLessThan(15);
});

test("when Monarch's transactions can't load, rows say payments couldn't be checked instead of showing them as unpaid", async ({ page, open, api }) => {
	api.failure = 'network';
	await open({ waitForRows: false });
	const row = itemRow(page, 'Piano Lessons');

	await expect(row).toContainText("Couldn't check payments", { timeout: 20_000 });
	await expect(page.getByText(/Owed since|Overdue/)).toHaveCount(0);
	await expect(page.getByText(/\$[\d,]+\.\d\d owed/)).toHaveCount(0);

	await row.click();
	const detail = page.locator('[data-wingspan-detail]');
	await expect(detail).toContainText("Couldn't check payments");
	await expect(detail.getByText('Owed', { exact: true })).toHaveCount(0);
});

test('data another Monarch household saved in this browser never shows', async ({ page, open, household }) => {
	await seedExtensionStorage(page, { 'wingspan:another-household': { version: 1, etag: 'other', value: household.sampleItems() } });
	await open({ withSampleItems: false, waitForRows: false });

	await expect(page.locator('[data-wingspan-statements]')).toContainText('No card payments yet');
	await expect(page.locator('[data-wingspan-row]')).toHaveCount(0);
});
