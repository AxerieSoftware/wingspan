const NEW_ISSUE_URL = 'https://github.com/AxerieSoftware/wingspan/issues/new';
const BUG_TEMPLATE = 'bug.yml';
/** In order: Edge's user agent also names Chrome, and Chrome's also names Safari. Orion's reads as Safari's. */
const KNOWN_BROWSERS = [
	{ name: 'Edge', pattern: /Edg\/(\d+)/ },
	{ name: 'Chrome', pattern: /Chrome\/(\d+)/ },
	{ name: 'Firefox', pattern: /Firefox\/(\d+)/ },
	{ name: 'Safari', pattern: /Version\/(\d+)[\d.]* .*Safari\// }
];

/** A new GitHub issue from the bug template, with the browser and Wingspan versions filled in. */
export class ProblemReport {
	public constructor(
		private readonly version: string,
		private readonly userAgent: string
	) {}

	/** The new issue link, with the versions in the bug template's browser field. */
	public get url(): string {
		const params = new URLSearchParams({ template: BUG_TEMPLATE, browser: `${this.browserName()}, Wingspan ${this.version}` });
		return `${NEW_ISSUE_URL}?${params}`;
	}

	private browserName(): string {
		for (const { name, pattern } of KNOWN_BROWSERS) {
			const match = pattern.exec(this.userAgent);
			if (match) return `${name} ${match[1]}`;
		}
		return 'Unknown browser';
	}
}
