import { expect, type OpenOptions, test } from './fixtures';

const openSettings = async (page: import('@playwright/test').Page, open: (options?: OpenOptions) => Promise<void>, options: OpenOptions = {}) => {
	await open({ path: '/settings/display', waitForRows: false, ...options });
	await page.getByRole('link', { name: 'General' }).last().click();
	await expect(page).toHaveURL(/\/settings\/wingspan/);
};

test("Monarch's Settings gets a Wingspan card that opens Wingspan's page", async ({ page, open }) => {
	await openSettings(page, open);
	const link = page.locator('[data-wingspan-card] a');
	await expect(link).toHaveText('General');
	await expect(link).toHaveAttribute('data-selected', '');
	await expect(page.getByRole('group', { name: 'Where Wingspan saves' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'See the wingspan account in Monarch' })).toBeVisible();
	await expect(page).toHaveTitle('Wingspan Settings');
});

test("navigating to another settings page removes Wingspan's page", async ({ page, open }) => {
	await openSettings(page, open);
	await page.getByRole('link', { name: 'Display' }).click();
	await expect(page.locator('[data-wingspan-page-column]')).toHaveCount(0);
	await expect(page.locator('[data-wingspan-card] a')).not.toHaveAttribute('data-selected', /.*/);
});

test("the notice's Settings link opens Wingspan's settings", async ({ page, open }) => {
	await open();
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page).toHaveURL(/\/settings\/wingspan/);
	await expect(page.getByRole('group', { name: 'Where Wingspan saves' })).toBeVisible();
});

test('About shows the version as a beta, with a link to report a problem', async ({ page, open }) => {
	await openSettings(page, open);
	const about = page.getByRole('group', { name: 'About' });
	await expect(about).toContainText(/Wingspan \d+\.\d+\.\d+\s*Beta/);
	const report = about.getByRole('link', { name: 'Report a problem' });
	await expect(report).toHaveAttribute('target', '_blank');
	const url = new URL((await report.getAttribute('href')) ?? '');
	expect(url.pathname).toBe('/axerieSoftware/wingspan/issues/new');
	expect(url.searchParams.get('browser')).toMatch(/^Chrome \d+, Wingspan \d+\.\d+\.\d+$/);
});
