import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const ORDER_SPLIT_PATH = '/transactions/tx-order-1';
const LINK = 'https://www.example.com/orders/5521';

const itemsCard = (page: Page) => page.getByRole('group', { name: 'Items in this order' });
/** Saving reloads Monarch's page, which takes a while to open the drawer again in the e2e setup. */
const AFTER_RELOAD = { timeout: 30_000 };

test("a split from a synced order lists the order's items, each in its split's category", async ({ page, household, open }) => {
	household.addSyncedOrder();
	await open({ path: ORDER_SPLIT_PATH, waitForRows: false });

	await expect(itemsCard(page).getByRole('list', { name: 'Items' }).getByRole('listitem')).toHaveCount(4);
	await expect(itemsCard(page).getByRole('combobox', { name: 'Fabrikam Espresso Maker, category' })).toHaveText('🍎 Groceries');
	await expect(itemsCard(page).getByRole('combobox', { name: 'Contoso Allergy Relief, category' })).toHaveText('💊 Medical');
	await expect(itemsCard(page)).toContainText('2 × $11.99');
	await expect(itemsCard(page).getByRole('button', { name: 'Save splits' })).toBeDisabled();
});

test('moving an item to another category saves one split per category, with the charge shared out by price to the cent', async ({ page, household, open }) => {
	household.addSyncedOrder();
	await open({ path: ORDER_SPLIT_PATH, waitForRows: false });

	await itemsCard(page).getByRole('combobox', { name: 'Fabrikam Espresso Maker, category' }).click();
	await page.getByRole('option', { name: 'Coffee Shops' }).click();
	await expect(itemsCard(page)).toContainText('Saves as 3 splits, shared out by price.');
	await itemsCard(page).getByRole('button', { name: 'Save splits' }).click();

	// $139.14 shared by price: $23.98 of paper towels, $181.08 of coffee things and $9.49 of allergy relief.
	await expect
		.poll(() => household.syncedOrderSplits.map(split => [split.categoryId, split.amount]))
		.toEqual([
			['cat-groceries', -15.56],
			['cat-coffee', -117.42],
			['cat-medical', -6.16]
		]);
	expect(household.syncedOrderSplits[1]?.notes).toBe(`1 x Fabrikam Espresso Maker - $167.99\n\n1 x Fabrikam Coffee PodsTM - $12.99\n\n${LINK}`);
	await expect(itemsCard(page).getByRole('combobox', { name: 'Fabrikam Espresso Maker, category' })).toHaveText('☕ Coffee Shops', AFTER_RELOAD);
	// Monarch saved "™" as "TM", and the pods still read as in their split rather than taken out.
	await expect(itemsCard(page).getByRole('combobox', { name: 'Fabrikam Coffee Pods™, category' })).toHaveText('☕ Coffee Shops');
});

test("a transaction that isn't split from a synced order has no items", async ({ page, household, open }) => {
	household.addSyncedOrder();
	await open({ path: '/transactions/tx-coffee', waitForRows: false });

	await expect(page.locator('[data-external-id="transaction-drawer-body"]')).toBeVisible();
	await expect(itemsCard(page)).toHaveCount(0);
});

test("an item you didn't get, like one cancelled after ordering, is crossed out and left out, with the charge shared across the rest", async ({ page, household, open }) => {
	household.addSyncedOrder();
	await open({ path: ORDER_SPLIT_PATH, waitForRows: false });

	await itemsCard(page).getByRole('button', { name: 'Remove Fabrikam Espresso Maker' }).click();
	await expect(itemsCard(page).getByRole('combobox', { name: 'Fabrikam Espresso Maker, category' })).toHaveCount(0);
	await expect(itemsCard(page)).toContainText('Saves as 3 splits, shared out by price, without the item you removed.');
	await itemsCard(page).getByRole('button', { name: 'Save splits' }).click();

	// $139.14 shared across $46.46 of items: $23.98 of paper towels, $12.99 of coffee pods and $9.49 of allergy relief.
	await expect
		.poll(() => household.syncedOrderSplits.map(split => [split.categoryId, split.amount]))
		.toEqual([
			['cat-groceries', -71.82],
			['cat-coffee', -38.9],
			['cat-medical', -28.42]
		]);
	expect(household.syncedOrderSplits[0]?.notes).toBe(`2 x Contoso Paper Towels - 12 Rolls - $11.99\n\n${LINK}`);
	await expect(itemsCard(page).getByRole('button', { name: 'Add back Fabrikam Espresso Maker' })).toBeVisible(AFTER_RELOAD);
});

test('an item removed by mistake can be added back to the split it was in', async ({ page, household, open }) => {
	household.addSyncedOrder();
	await open({ path: ORDER_SPLIT_PATH, waitForRows: false });

	await itemsCard(page).getByRole('button', { name: 'Remove Contoso Allergy Relief' }).click();
	await itemsCard(page).getByRole('button', { name: 'Add back Contoso Allergy Relief' }).click();

	await expect(itemsCard(page).getByRole('combobox', { name: 'Contoso Allergy Relief, category' })).toHaveText('💊 Medical');
	await expect(itemsCard(page).getByRole('button', { name: 'Save splits' })).toBeDisabled();
});
