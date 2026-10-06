import * as v from 'valibot';
import { logError } from '../../common/log';
import { describeIssues } from '../../common/schemaIssues';

/** A list that skips entries with an unexpected shape instead of failing the whole response, logging them once per response. */
export const lenientArray = <TSchema extends v.GenericSchema>(label: string, schema: TSchema) =>
	v.pipe(
		v.array(v.unknown()),
		v.transform(entries => {
			const issues: v.BaseIssue<unknown>[] = [];
			const parsed = entries.flatMap((entry): v.InferOutput<TSchema>[] => {
				const result = v.safeParse(schema, entry);
				if (result.success) return [result.output];
				issues.push(...result.issues);
				return [];
			});
			const skipped = entries.length - parsed.length;
			if (skipped) logError(new Error(`${label}: skipped ${skipped} of ${entries.length}, ${describeIssues(issues)}`));
			return parsed;
		})
	);
