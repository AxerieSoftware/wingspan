/** The hosts Monarch serves merchant logos from. Saved icons are only loaded from here. */
const MONARCH_LOGO_HOSTS = ['.monarch.com', '.monarchmoney.com'];
const MONARCH_CLOUDINARY = { host: 'res.cloudinary.com', pathPrefix: '/monarch-money/' };

/**
 * The saved logo's URL, only if it points to Monarch. Saved icons come from notes any household member can edit, so
 * loading an image from another host would let that site track who views it.
 */
export function savedLogoUrl(savedUrl: string | undefined): string | null {
	if (!savedUrl) return null;
	try {
		const url = new URL(savedUrl);
		const isFromMonarch = MONARCH_LOGO_HOSTS.some(host => url.hostname.endsWith(host)) || (url.hostname === MONARCH_CLOUDINARY.host && url.pathname.startsWith(MONARCH_CLOUDINARY.pathPrefix));
		return url.protocol === 'https:' && isFromMonarch ? url.href : null;
	} catch {
		return null;
	}
}
