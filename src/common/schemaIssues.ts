import type * as v from 'valibot';

/** Valibot's issues as one line for logs and error messages: each path and what it expected, repeats dropped. */
export function describeIssues(issues: readonly v.BaseIssue<unknown>[]): string {
	const described = issues.map(issue => {
		// List indexes are left out, so the same problem across many entries is only reported once.
		const path = issue.path?.map(item => (typeof item.key === 'number' ? '*' : String(item.key))).join('.') || '(root)';
		return `${path}: expected ${issue.expected ?? issue.kind}`;
	});
	return [...new Set(described)].join('; ');
}
