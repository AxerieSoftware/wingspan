import { defineConfig } from 'wxt';

export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	manifestVersion: 3,
	// AMO's reviewers rebuild the extension from the sources zip, which needs none of these.
	zip: { excludeSources: ['site/**', 'tests/**', 'store/**'] },
	manifest: ({ browser }) => ({
		name: 'Wingspan for Monarch Money',
		short_name: 'Wingspan',
		description: 'A third-party extension that adds features to the Monarch Money web app. Not affiliated with Monarch.',
		permissions: ['storage', 'scripting'],
		optional_host_permissions: ['https://www.walmart.com/*', 'https://www.costco.com/*'],
		homepage_url: 'https://wingspan.axerie.com',
		...(browser === 'firefox'
			? {
					browser_specific_settings: {
						// data_collection_permissions needs Firefox 140 on desktop and 142 on Android.
						gecko: { id: 'wingspan@axerie.com', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
						gecko_android: { strict_min_version: '142.0' }
					}
				}
			: {}),
		...(browser === 'chrome' || browser === 'edge'
			? {
					// Firefox and Safari don't support split.
					incognito: 'split'
				}
			: {})
	})
});
