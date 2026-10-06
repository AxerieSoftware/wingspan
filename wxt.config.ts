import { defineConfig } from 'wxt';

export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	manifestVersion: 3,
	manifest: ({ browser }) => ({
		name: 'Wingspan for Monarch Money',
		short_name: 'Wingspan',
		description: 'Extended features inside the Monarch Money web app. Not affiliated with Monarch.',
		permissions: ['storage', 'scripting'],
		optional_host_permissions: ['https://www.walmart.com/*', 'https://www.costco.com/*'],
		homepage_url: 'https://wingspan.axerie.com',
		...(browser === 'firefox'
			? {
					browser_specific_settings: {
						// Temporal ships natively from Firefox 139 and DisposableStack from 141.
						gecko: { id: 'wingspan@axerie.com', strict_min_version: '141.0', data_collection_permissions: { required: ['none'] } },
						gecko_android: { strict_min_version: '142.0' }
					}
				}
			: {}),
		...(browser === 'chrome' || browser === 'edge'
			? {
					// Temporal ships natively from Chrome and Edge 144. Only Safari's build bundles a polyfill.
					minimum_chrome_version: '144',
					// Firefox and Safari don't support split.
					incognito: 'split'
				}
			: {})
	})
});
