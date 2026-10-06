import * as v from 'valibot';
import { logError } from '../../common/log';
import { describeIssues } from '../../common/schemaIssues';
import { MonarchApiError, SIGNED_OUT_MESSAGE } from './monarchApiError';
import type { MonarchRequestHook } from './monarchRequestHook';

const API_URL = 'https://api.monarch.com';
const GRAPHQL_URL = `${API_URL}/graphql`;
const SIGNED_OUT_STATUSES = new Set([401, 403]);
const SERVER_ERROR_STATUS = 500;
const REQUEST_TIMEOUT_MS = 30_000;

interface GraphQlResponse {
	data?: unknown;
	errors?: { message?: string; path?: (string | number)[]; extensions?: { code?: unknown } }[];
}

/** Monarch's GraphQL API, called from Monarch's page with its session, the same way its web app does. */
export class MonarchClient {
	private readonly url: string;
	private readonly clientQuery: string;

	public constructor(
		private readonly requestHook: MonarchRequestHook,
		clientName: string,
		/** Throws when the session has changed, so this page shouldn't send requests or use their responses. */
		private readonly checkSession: () => void = () => {}
	) {
		this.clientQuery = `?${new URLSearchParams({ client: clientName })}`;
		this.url = `${GRAPHQL_URL}${this.clientQuery}`;
	}

	/** The response's data, checked against `schema`: if Monarch changes its response format, this throws instead of guessing. */
	public async request<TData>(operationName: string, query: string, schema: v.GenericSchema<unknown, TData>, variables: Record<string, unknown> = {}): Promise<TData> {
		this.checkSession();
		let httpResponse: Response;
		try {
			httpResponse = await fetch(this.url, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', 'Client-Platform': 'web', ...this.requestHook.headers() },
				body: JSON.stringify({ operationName, query, variables }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch (error) {
			throw new MonarchApiError("Monarch couldn't be reached.", true, { cause: error });
		}
		this.checkSession();
		if (!httpResponse.ok) throw this.httpError(httpResponse.status);

		let response: GraphQlResponse;
		try {
			response = (await httpResponse.json()) as GraphQlResponse;
		} catch (error) {
			throw new MonarchApiError("Monarch's response couldn't be read.", true, { cause: error });
		}
		if (response.errors?.length) {
			// Don't log the messages: an error about a rejected variable can include its value, which is household data.
			const where = response.errors.map(graphQlError => [graphQlError.path?.join('.') ?? 'request', graphQlError.extensions?.code].filter(Boolean).join(' '));
			logError(new Error(`${operationName} was refused at ${where.join('; ')}`));
			throw new MonarchApiError('Monarch returned an error.', false);
		}
		if (!response.data) throw new MonarchApiError('Monarch returned no data.', false);

		const result = v.safeParse(schema, response.data);
		if (!result.success) {
			logError(new Error(`${operationName}: ${describeIssues(result.issues)}`));
			throw new MonarchApiError("Monarch changed its data format, so Wingspan can't read it until Wingspan is updated.", false);
		}
		return result.output;
	}

	/** A file upload to one of Monarch's REST endpoints, as its web app sends them. */
	public async postForm(path: string, form: FormData): Promise<void> {
		this.checkSession();
		let httpResponse: Response;
		try {
			httpResponse = await fetch(`${API_URL}${path}${this.clientQuery}`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Client-Platform': 'web', ...this.requestHook.headers() },
				body: form,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch (error) {
			throw new MonarchApiError("Monarch couldn't be reached.", true, { cause: error });
		}
		this.checkSession();
		if (!httpResponse.ok) throw this.httpError(httpResponse.status);
	}

	private httpError(status: number): MonarchApiError {
		if (SIGNED_OUT_STATUSES.has(status)) return new MonarchApiError(SIGNED_OUT_MESSAGE, false);
		if (status >= SERVER_ERROR_STATUS) return new MonarchApiError(`Monarch is having trouble right now (error ${status}).`, true);
		return new MonarchApiError(`Monarch rejected Wingspan's request (error ${status}).`, false);
	}
}
