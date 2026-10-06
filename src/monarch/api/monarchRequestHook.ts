const CSRF_COOKIE_PATTERN = /(?:^|;\s*)csrftoken=([^;]+)/;

/** Monarch's session cookies go with every request; the CSRF token has to be copied into a header. */
export class MonarchRequestHook {
	public constructor(private readonly document: Document) {}

	/** The CSRF header, or none when the cookie isn't there. */
	public headers(): Record<string, string> {
		const csrfToken = CSRF_COOKIE_PATTERN.exec(this.document.cookie)?.[1];
		return csrfToken ? { 'X-CSRFToken': decodeURIComponent(csrfToken) } : {};
	}
}
