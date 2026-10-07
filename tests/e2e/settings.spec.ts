import { expect, type OpenOptions, test } from './fixtures';

const openSettings = async (page: import('@playwright/test').Page, open: (options?: OpenOptions) => Promise<void>, options: OpenOptions = {}) => {
	await open({ path: '/settings/display', waitForRows: false, ...options });
	await page.locator('[data-wingspan-card]').getByRole('link', { name: 'General' }).click();
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
	expect(url.pathname).toBe('/AxerieSoftware/wingspan/issues/new');
	expect(url.searchParams.get('browser')).toMatch(/^Chrome \d+, Wingspan \d+\.\d+\.\d+$/);
});

test("unchecking a sidebar item hides it from Monarch's sidebar, from the start of the next load", async ({ page, open }) => {
	await openSettings(page, open);
	const sidebar = page.locator('[data-external-id="side-bar"]');
	const settings = page.getByRole('group', { name: 'Sidebar' });
	await expect(settings.getByRole('checkbox')).toHaveCount(await sidebar.locator('[data-external-id="nav-bar-link"], [data-external-id="sidebar-persistent-assistant"]').count());

	await settings.getByRole('checkbox', { name: 'Budget' }).click();
	await settings.getByRole('checkbox', { name: 'Help & Support' }).click();
	await expect(sidebar.getByRole('link', { name: 'Budget' })).toBeHidden();
	await expect(sidebar.getByText('Help & Support')).toBeHidden();
	await expect(sidebar.getByRole('link', { name: 'Reports' })).toBeVisible();

	await page.reload();
	await sidebar.getByRole('link', { name: 'Reports' }).waitFor();
	// Read as soon as the sidebar renders: the early script hid it before Monarch's app started, so it never shows.
	expect(await sidebar.locator('a[href="/plan"]').evaluate(linkEl => getComputedStyle(linkEl).display)).toBe('none');
	await expect(settings.getByRole('checkbox', { name: 'Budget' })).not.toBeChecked();

	await settings.getByRole('checkbox', { name: 'Budget' }).click();
	await expect(sidebar.getByRole('link', { name: 'Budget' })).toBeVisible();
	await expect(sidebar.getByText('Help & Support')).toBeHidden();
});
