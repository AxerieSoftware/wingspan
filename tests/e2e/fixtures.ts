import fs from 'node:fs';
import path from 'node:path';
import { type BrowserContext, test as base, chromium, expect, type Locator, type Page, type Route } from '@playwright/test';
import type { IntrospectionQuery } from 'graphql';
import { GraphqlMock } from './graphqlMock';
import { Household } from './household';

/*
 * Monarch's real web app served from a local snapshot of its public bundle (tests/.monarch-snapshot/, out of git),
 * with the built extension loaded and every API call answered by a made-up household.
 * `npm run e2e:refresh` deletes the snapshot so the next run fetches Monarch's latest bundle.
 */
export const APP = 'https://app.monarch.com';
const SNAPSHOT = path.resolve('tests/.monarch-snapshot');
const EXTENSION = path.resolve('.output/chrome-mv3');
const MONARCH_HOSTS = new Set(['app.monarch.com', 'static.monarch.com']);
// The content script runs on this page; Monarch's app doesn't.
const BLANK_PATH = '/__e2e/blank';
const WINGSPAN_OPERATION_PREFIX = 'wingspan_';
const SEED_SETTLE_MS = 300;
const EXTENSION_NAME = 'Wingspan for Monarch Money';
const STRIPE_STAND_IN = 'window.Stripe = function () { return new Proxy({}, { get: function () { return function () { return {}; }; } }); };';
const SCHEMA_START = 'JSON.parse(\'{"__schema"';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SESSION_USER = {
	id: 'user-1',
	external_id: 'user-1',
	created_at: '2024-01-01T00:00:00Z',
	name: 'Test User',
	display_name: 'Test',
	email: 'test@example.com',
	timezone: 'America/Chicago',
	token: null,
	tokenExpiration: null,
	session_expires_at: '2099-01-01T00:00:00Z',
	birthday: null,
	household: { id: 'household-1', external_id: 'household-1', name: 'Test household', address: '', city: '', state: '', zip_code: '' },
	is_demo: false,
	is_temporary_demo: false,
	is_sponsor: false,
	household_role: 'owner',
	should_force_redirect_sponsor: false,
	has_completed_onboarding: true,
	ads_consent_disabled: true,
	other_info: {},
	split_attributes: {}
};

/** How the mocked API responds to Wingspan's requests. Monarch's own requests are always answered immediately. */
export interface ApiBehavior {
	delayMs: number;
	/** Wingspan's requests wait for this before they're answered, so a test can check loading states without racing a timer. */
	held?: Promise<void>;
	failure: 'network' | number | null;
}

export class ApiLog {
	public readonly operations: string[] = [];
	/** Files uploaded to Monarch's REST endpoints, by path and file name. */
	public readonly uploads: { path: string; fileName: string; isPdf: boolean }[] = [];
	public pending = 0;
}

export interface OpenOptions {
	path?: string;
	withSampleItems?: boolean;
	waitForRows?: boolean;
}

interface E2eFixtures {
	household: Household;
	/** Recurring 2.0's grouping, as set by its "By …" menu. */
	groupBy: string;
	api: ApiBehavior;
	apiLog: ApiLog;
	context: BrowserContext;
	page: Page;
	/** Opens a page with Wingspan's storage seeded as asked, once Wingspan's requests have settled. */
	open(options?: OpenOptions): Promise<void>;
}

export const test = base.extend<E2eFixtures>({
	household: async ({}, use) => use(new Household()),
	groupBy: ['type', { option: true }],
	api: async ({}, use) => use({ delayMs: 0, failure: null }),
	apiLog: async ({}, use) => use(new ApiLog()),
	context: async ({ household, api, apiLog, groupBy, viewport, deviceScaleFactor }, use) => {
		const context = await chromium.launchPersistentContext('', {
			channel: 'chromium',
			headless: !process.env.HEADED,
			viewport,
			deviceScaleFactor,
			args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`]
		});
		const graphqlMock = new GraphqlMock(await monarchSchema(), household.resolvers);
		await context.addCookies([{ name: 'csrftoken', value: 'e2e-csrf', domain: '.monarch.com', path: '/', secure: true }]);
		await context.addInitScript(
			({ user, groupBy }) => {
				if (location.host !== 'app.monarch.com' || localStorage.getItem('persist:root')) return;
				const persisted = JSON.stringify({ version: -1, rehydrated: true });
				localStorage.setItem('persist:root', JSON.stringify({ user: JSON.stringify(user), _persist: persisted }));
				localStorage.setItem('persist:recurringV2', JSON.stringify({ groupBy: JSON.stringify(groupBy), _persist: persisted }));
			},
			{ user: SESSION_USER, groupBy }
		);
		await context.route('**/*', route => answer(route, graphqlMock, api, apiLog));
		await use(context);
		await context.close();
	},
	page: async ({ context }, use) => {
		const page = context.pages()[0] ?? (await context.newPage());
		if (process.env.E2E_DEBUG) page.on('console', message => message.type() !== 'debug' && console.log(`[page ${message.type()}] ${message.text().slice(0, 400)}`));
		await use(page);
	},
	open: async ({ page, household, apiLog }, use) => {
		await use(async ({ path = '/recurring-v2/monthly', withSampleItems = true, waitForRows = true } = {}) => {
			const items: Record<string, unknown> = {};
			if (withSampleItems) items[storageKey('wingspan')] = { version: 1, etag: 'sample', value: household.sampleItems() };
			if (Object.keys(items).length) await seedExtensionStorage(page, items);
			await page.goto(`${APP}${path}`);
			if (waitForRows) await page.locator('[data-wingspan-row]').first().waitFor({ timeout: 30_000 });
			await settled(apiLog);
		});
	}
});

export { expect };

/** Writes Wingspan's chrome.storage.local from a blank page; Wingspan reads storage only when a page loads. */
export async function seedExtensionStorage(page: Page, items: Record<string, unknown>) {
	await page.goto(`${APP}${BLANK_PATH}`);
	// Wingspan still starts on the blank page, so the seed is written after it has loaded its data.
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(SEED_SETTLE_MS);
	// Clear first so storage holds only the seed, not anything the blank page's Wingspan saved, like its synced copy.
	await inContentScript(page, `chrome.storage.local.clear().then(() => chrome.storage.local.set(${JSON.stringify(items)}))`);
}

export async function seedSampleItems(page: Page, household: Household) {
	await seedExtensionStorage(page, { [storageKey('wingspan')]: { version: 1, etag: 'sample', value: household.sampleItems() } });
}

/** Runs an expression in Wingspan's content-script world, which the page can't reach. */
export async function inContentScript(page: Page, expression: string): Promise<unknown> {
	const cdp = await page.context().newCDPSession(page);
	const contextIds: number[] = [];
	cdp.on('Runtime.executionContextCreated', ({ context }) => {
		if (context.name === EXTENSION_NAME) contextIds.push(context.id);
	});
	await cdp.send('Runtime.enable');
	for (let attempt = 0; attempt < 50 && !contextIds.length; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
	const contextId = contextIds.at(-1);
	if (contextId === undefined) throw new Error("Wingspan's content script isn't running on this page");

	const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true });
	await cdp.detach();
	if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
	return result.value;
}

/** Waits until none of Wingspan's requests are in flight for two checks in a row, since a month change can start a second round of requests. */
export async function settled(apiLog: ApiLog) {
	for (let quietChecks = 0; quietChecks < 2; ) {
		await new Promise(resolve => setTimeout(resolve, 50));
		quietChecks = apiLog.pending === 0 ? quietChecks + 1 : 0;
	}
}

/** Monarch keeps its theme in persist:root and reads it when the app starts. */
export async function useTheme(page: Page, theme: 'light' | 'dark') {
	await page.evaluate(themePreference => {
		const root = JSON.parse(localStorage.getItem('persist:root') ?? '{}');
		const persistentUi = JSON.parse(root.persistentUi ?? '{}');
		root.persistentUi = JSON.stringify({ ...persistentUi, themePreference });
		localStorage.setItem('persist:root', JSON.stringify(root));
	}, theme);
	await page.reload();
}

/** Wingspan caches its data in the browser per Monarch household. */
export const storageKey = (name: string) => `${name}:${SESSION_USER.household.id}`;

/** An item's row for the month shown; unpaid occurrences from earlier months come before it. */
export const itemRow = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true }).last();

export const section = (page: Page, name: string) => page.getByTestId(`recurring-section-card-${name}`);

/** Opens Monarch's "Add recurring" dialog from "Add manually" with one of Wingspan's types chosen. */
export async function addRecurring(page: Page, type: 'Bill' | 'Card payment') {
	await page.getByRole('button', { name: 'Add recurring' }).click();
	await page.getByRole('menuitem', { name: 'Add manually' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add recurring' });
	await dialog.getByRole('combobox', { name: 'Type' }).click();
	await page.getByRole('option', { name: type }).click();
	return dialog;
}

/** Closes the notice a first open shows about the hidden account, which sits over the bottom of a tall dialog for 15 seconds. */
export async function dismissFirstRunNotice(page: Page) {
	await page.getByRole('button', { name: 'Dismiss' }).click();
	await expect(page.getByText('Wingspan now saves to your Monarch account')).toHaveCount(0);
}

export async function chooseMerchant(page: Page, dialog: Locator, name: string) {
	await dialog.locator('button[aria-label^="Merchant: "]').click();
	await page.getByPlaceholder('Search merchants').fill(name);
	await page.getByRole('option', { name }).click();
}

/** A table's rows in the order shown; Wingspan orders them with flex `order`. */
async function shownRows(table: Locator) {
	return table.evaluate(card =>
		[...card.querySelectorAll<HTMLElement>('[data-testid^="recurring-section-scroll-"] > div > [role="button"], [data-wingspan-statements] [role="button"]')]
			.sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0))
			.map(row => ({
				// The first text longer than an avatar's initial.
				name: [...row.querySelectorAll('*')].find(element => !element.children.length && (element.textContent ?? '').trim().length > 1)?.textContent ?? '',
				subtitle: [...row.querySelectorAll('*')].find(element => !element.children.length && /(Due|Next) \w{3} \d/.test(element.textContent ?? ''))?.textContent ?? '',
				ownDate: row.getAttribute('data-wingspan-date')
			}))
	);
}

export async function rowNames(table: Locator) {
	return (await shownRows(table)).map(row => row.name);
}

/** Each row's sort date as a number: Wingspan's rows store it in an attribute, Monarch's show it in the "· Due Sep 14" label. */
export async function rowDates(table: Locator, year: number) {
	return (await shownRows(table)).map(row => {
		if (row.ownDate) return Number(row.ownDate.replaceAll('-', ''));
		const match = /(?:Due|Next) (\w{3}) (\d{1,2})/.exec(row.subtitle);
		return match ? year * 10000 + (MONTHS.indexOf(match[1] ?? '') + 1) * 100 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
	});
}

export const ascending = (values: number[]) => values.every((value, index) => index === 0 || (values[index - 1] as number) <= value);

export const shownYear = async (page: Page) => Number((await page.getByRole('heading', { level: 1 }).textContent())?.match(/\d{4}/)?.[0]);

async function answer(route: Route, graphqlMock: GraphqlMock, api: ApiBehavior, apiLog: ApiLog) {
	const request = route.request();
	const url = new URL(request.url());
	if (url.protocol !== 'https:') return route.continue();
	if (MONARCH_HOSTS.has(url.host)) return serveSnapshot(route, url);
	// Monarch's Stripe loader reports an error without Stripe.
	if (url.host === 'js.stripe.com') return route.fulfill({ contentType: 'text/javascript', body: STRIPE_STAND_IN });
	if (url.host !== 'api.monarch.com') return route.abort();
	if (url.pathname !== '/graphql') {
		const posted = request.method() === 'POST' ? (request.postDataBuffer()?.toString('latin1') ?? '') : '';
		const fileName = /filename="([^"]+)"/.exec(posted)?.[1];
		if (fileName) apiLog.uploads.push({ path: url.pathname, fileName, isPdf: posted.includes('%PDF-1.4') });
		return route.fulfill({ status: 200, contentType: 'application/json', body: url.pathname === '/users/me/' ? JSON.stringify(SESSION_USER) : '{}' });
	}

	const body = request.postDataJSON() as { operationName?: string; query: string; variables?: Record<string, unknown> };
	const isWingspan = !!body.operationName?.startsWith(WINGSPAN_OPERATION_PREFIX);
	apiLog.operations.push(body.operationName ?? 'anonymous');
	if (process.env.E2E_DEBUG) console.log(`[e2e] ${body.operationName}`);
	if (isWingspan) apiLog.pending += 1;
	try {
		if (isWingspan && api.delayMs) await new Promise(resolve => setTimeout(resolve, api.delayMs));
		if (isWingspan) await api.held;
		if (isWingspan && api.failure === 'network') return await route.abort('failed');
		if (isWingspan && typeof api.failure === 'number') return await route.fulfill({ status: api.failure, body: '' });
		const result = await graphqlMock.respond(body.query, body.operationName, body.variables ?? {});
		if (result.errors?.length) console.warn(`[e2e] ${body.operationName}: ${result.errors.map(error => error.message).join('; ')}`);
		return await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
	} finally {
		if (isWingspan) apiLog.pending -= 1;
	}
}

/** Every page route gets the app's index.html. */
async function serveSnapshot(route: Route, url: URL) {
	if (url.pathname === BLANK_PATH) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Blank</title>' });
	const isPage = url.host === 'app.monarch.com' && !path.extname(url.pathname);
	const file = await snapshotFile(isPage ? `${APP}/` : url.href);
	return file ? route.fulfill({ path: file, contentType: isPage ? 'text/html' : undefined }) : route.fulfill({ status: 404, body: '' });
}

async function snapshotFile(href: string): Promise<string | null> {
	const url = new URL(href);
	const file = path.join(SNAPSHOT, url.host, url.pathname === '/' ? 'index.html' : url.pathname);
	if (fs.existsSync(file)) return file;

	const response = await fetch(href);
	if (!response.ok) return null;
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
	return file;
}

/** Monarch's main bundle ships its GraphQL schema as introspection JSON. */
async function monarchSchema(): Promise<IntrospectionQuery> {
	const cached = path.join(SNAPSHOT, 'schema.json');
	if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));

	const indexHtml = fs.readFileSync((await snapshotFile(`${APP}/`)) as string, 'utf8');
	const mainScript = /https:\/\/static\.monarch\.com\/static\/js\/main\.[\w]+\.js/.exec(indexHtml)?.[0];
	if (!mainScript) throw new Error("Monarch's index.html has no main bundle; run npm run e2e:refresh");
	const bundle = fs.readFileSync((await snapshotFile(mainScript)) as string, 'utf8');
	const start = bundle.indexOf(SCHEMA_START);
	if (start < 0) throw new Error("Monarch's main bundle doesn't ship its schema");

	// The schema is a single-quoted JS string literal: find its closing quote, then let JS undo its escapes.
	const literalStart = start + "JSON.parse('".length;
	let literalEnd = literalStart;
	while (literalEnd < bundle.length && bundle.charAt(literalEnd) !== "'") literalEnd += bundle.charAt(literalEnd) === '\\' ? 2 : 1;
	const schema: IntrospectionQuery = JSON.parse(new Function(`return '${bundle.slice(literalStart, literalEnd)}'`)());
	fs.writeFileSync(cached, JSON.stringify(schema));
	return schema;
}

/** Reloads the extension the way a developer would. Chrome leaves the old content script running in the open tab, disconnected from the extension. */
export async function reloadExtension(context: BrowserContext) {
	const extensionsPage = await context.newPage();
	await extensionsPage.goto('chrome://extensions');
	await extensionsPage.evaluate(async () => {
		const developerPrivate = (globalThis as unknown as { chrome: { developerPrivate: { getExtensionsInfo(): Promise<{ id: string }[]>; reload(id: string, options: object): Promise<void> } } }).chrome
			.developerPrivate;
		const [wingspan] = await developerPrivate.getExtensionsInfo();
		if (wingspan) await developerPrivate.reload(wingspan.id, { failQuietly: true });
	});
	await extensionsPage.close();
}
