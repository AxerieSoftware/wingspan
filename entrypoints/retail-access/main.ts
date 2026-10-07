import { browser } from 'wxt/browser';
import { isRetailer, RETAILERS, type RetailSyncUpdate } from '@/src/features/retailSync/shared/models/retailSyncMessages';

const searchParams = new URLSearchParams(location.search);
const retailer = searchParams.get('retailer');
const monarchTabId = Number(searchParams.get('monarchTab'));
const status = document.getElementById('status') as HTMLElement;

if (isRetailer(retailer)) {
	const retailerInfo = RETAILERS[retailer];
	const siteOrigin = new URL(retailerInfo.origin.replace('/*', '')).hostname.replace(/^www\./, '');
	document.title = `${retailerInfo.name} Sync Permission - Wingspan`;

	(document.getElementById('title') as HTMLElement).textContent = `Let Wingspan read your ${retailerInfo.name} purchase history`;
	(document.getElementById('explanation') as HTMLElement).textContent =
		`To send your ${retailerInfo.name} purchase history to Monarch, Wingspan reads your purchase history on ${siteOrigin}, in a tab it opens while you're signed in there. It never signs in for you or changes anything on ${retailerInfo.name}.`;

	const allowButton = document.getElementById('allow') as HTMLButtonElement;
	allowButton.textContent = `Allow ${siteOrigin}`;
	allowButton.addEventListener('click', async () => {
		const isGranted = await browser.permissions.request({ origins: [retailerInfo.origin] });
		if (!isGranted) {
			status.textContent = `Permission wasn't granted, so Wingspan can't read your ${retailerInfo.name} purchase history. Nothing was changed.`;
			const refused: RetailSyncUpdate = { type: 'retailSync:failed', retailer, reason: 'retailerPermission' };
			await browser.tabs.sendMessage(monarchTabId, refused).catch(() => undefined);
			return;
		}

		const granted: RetailSyncUpdate = { type: 'retailSync:granted', retailer };
		try {
			await browser.tabs.sendMessage(monarchTabId, granted);
		} catch {
			status.textContent = `Permission granted, but the Monarch tab was closed. Start the ${retailerInfo.name} sync again from Monarch.`;
			return;
		}
		window.close();
	});
}
