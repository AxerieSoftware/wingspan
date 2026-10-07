import * as v from 'valibot';
import { logError } from '../../common/log';
import type { MonarchAccountsClient } from '../../monarch/api/monarchAccountsClient';
import { ETagMismatchError } from '../errors/eTagMismatchError';
import { InvalidSavedDataError } from '../errors/invalidSavedDataError';
import { type Envelope, EnvelopeSchema, ensureCanOverwrite } from '../models/envelope';
import type { Store } from './store';

const ACCOUNT_NAME = 'wingspan';
/** The data source name used in error messages. */
export const MONARCH_SOURCE = 'Monarch';
/** The first line of the hidden account's notes. Warns users not to edit them and marks the account as Wingspan's. */
export const SAFETY_HEADER = "Do not edit. This data is managed by 'Wingspan for Monarch Money' extension.";

interface SavedAccount<TValue> {
	accountId: string;
	envelope: Envelope<TValue> | undefined;
}

/**
 * Saves the envelope in the notes of a hidden manual account: the oldest named exactly "wingspan" whose notes start with
 * the safety header. Any other account, like one named "Wingspan" or one the user made, is never touched.
 */
export class MonarchAccountStore<TValue> implements Store<TValue> {
	private accountId: string | undefined;

	public constructor(private readonly accountsClient: MonarchAccountsClient) {}

	/** The account last found or created. */
	public get linkedAccountId(): string | undefined {
		return this.accountId;
	}

	/** The envelope in Wingspan's account, or undefined when there's no account or nothing saved yet. */
	public async load(): Promise<Envelope<TValue> | undefined> {
		return (await this.findAccount())?.envelope;
	}

	/**
	 * Best effort: Monarch has no conditional update, so another browser can still write between the read and the write.
	 * Reading the write back catches most of those.
	 */
	public async store(envelope: Envelope<TValue>): Promise<Envelope<TValue>> {
		let account = await this.findAccount();
		if (!account) {
			const createdId = await this.createAccount();
			// Another browser may have created one at the same time. The oldest wins, and this page's unused account is deleted.
			account = (await this.findAccount()) ?? { accountId: createdId, envelope: undefined };
			if (account.accountId !== createdId) await this.accountsClient.deleteAccount(createdId).catch(logError);
		}
		const savedEnvelope = account.envelope;
		ensureCanOverwrite(savedEnvelope, envelope);

		// Keep any fields a newer version of Wingspan added to the envelope.
		const storedEnvelope = { ...savedEnvelope, ...envelope, etag: crypto.randomUUID() };
		await this.accountsClient.updateAccount({ id: account.accountId, notes: `${SAFETY_HEADER}\n\n${JSON.stringify(storedEnvelope)}` });
		// Read it back. If another browser wrote in the meantime and replaced this, retry the change on top of theirs.
		const writtenNotes = await this.accountsClient.getAccountNotes(account.accountId);
		const writtenEnvelope = writtenNotes ? this.parseNotes(writtenNotes.notes) : undefined;
		if (writtenEnvelope?.etag !== storedEnvelope.etag) throw new ETagMismatchError(writtenEnvelope?.etag ?? '', storedEnvelope.etag);
		return storedEnvelope;
	}

	/** Looked up fresh every time, so if two browsers created an account at once, both end up using the oldest. */
	private async findAccount(): Promise<SavedAccount<TValue> | undefined> {
		const summaries = await this.accountsClient.getAccountSummaries();
		const candidates = summaries.filter(summary => summary.displayName === ACCOUNT_NAME).sort((a, b) => this.compareOldestFirst(a.id, b.id));
		for (const summary of candidates) {
			const accountNotes = await this.accountsClient.getAccountNotes(summary.id);
			if (!accountNotes?.notes?.startsWith(SAFETY_HEADER)) continue;

			this.accountId = summary.id;
			// Cosmetic only: the account works the same if it shows in Monarch's lists.
			if (!summary.isHidden) await this.accountsClient.updateAccount({ id: summary.id, hideFromList: true }).catch(logError);
			return { accountId: summary.id, envelope: this.parseNotes(accountNotes.notes) };
		}
		this.accountId = undefined;
		return undefined;
	}

	/** Monarch's ids grow over time; a longer id is a later one. */
	private compareOldestFirst(first: string, second: string): number {
		return first.length - second.length || first.localeCompare(second);
	}

	/** Notes with only the safety header belong to an account that was created but not saved to yet. */
	private parseNotes(notes: string | null): Envelope<TValue> | undefined {
		const body = notes?.startsWith(SAFETY_HEADER) ? notes.slice(SAFETY_HEADER.length).trim() : (notes ?? '');
		if (!body) return undefined;

		let savedEnvelope: unknown;
		try {
			savedEnvelope = JSON.parse(body);
		} catch {
			throw new InvalidSavedDataError(MONARCH_SOURCE, "the account notes aren't valid JSON");
		}

		if (!v.is(EnvelopeSchema, savedEnvelope)) throw new InvalidSavedDataError(MONARCH_SOURCE, "the account notes aren't Wingspan's format");
		return savedEnvelope as Envelope<TValue>;
	}

	/** Hidden and marked as Wingspan's in one update, so it's never left visible in Monarch or unrecognized. If that fails, the new account is deleted. */
	private async createAccount(): Promise<string> {
		const createdId = await this.accountsClient.createManualAccount({ type: 'other_asset', subtype: 'other', includeInNetWorth: false, name: ACCOUNT_NAME, displayBalance: 0 });
		try {
			await this.accountsClient.updateAccount({ id: createdId, notes: SAFETY_HEADER, hideFromList: true });
		} catch (error) {
			await this.accountsClient.deleteAccount(createdId).catch(logError);
			throw error;
		}
		return createdId;
	}
}
