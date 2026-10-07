import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import type { Account } from '../../../../monarch/api/models/account';
import { Button } from '../../../../monarch/ui/components/button';
import { Dialog } from '../../../../monarch/ui/components/dialog';
import { Field, FormGrid } from '../../../../monarch/ui/components/field';
import { Fieldset } from '../../../../monarch/ui/components/fieldset';
import { ChevronIcon, Icon } from '../../../../monarch/ui/components/icons';
import { MoneyInput } from '../../../../monarch/ui/components/input';
import { Select, type SelectOption } from '../../../../monarch/ui/components/select';
import { SwitchRow } from '../../../../monarch/ui/components/switch';
import { TooltipButton } from '../../../../monarch/ui/components/tooltip';
import type { Formatter } from '../../../../monarch/ui/formatter';
import { iconButtonStyles } from '../../../../monarch/ui/styles';
import { ESTIMATED_MINIMUM_RULE } from '../../../recurring/statements/models/cardPaymentPlans';
import { aprOf, creditLimitOf, minimumPaymentOf } from '../../projectedBalances/models/cardTerms';
import type { CashSettings } from '../models/cashSettings';
import { SAFETY_DAY_CHOICES, type SavedCashSettings } from '../models/savedCashSettings';

const CUSHION_STEP = 50;
type CashRole = 'checking' | 'reserve' | 'none';
const CASH_ROLES: readonly SelectOption<CashRole>[] = [
	['checking', 'Checking'],
	['reserve', 'Reserve'],
	['none', 'Not counted']
];

/** Whose settings these are, when the household has businesses: its own, or one business's. */
export interface CashSettingsOwnerChoice {
	options: readonly SelectOption<string>[];
	value: string;
	onChange(ownerId: string): void;
}

/** settings are the form's initial values. onSave gets every field, and the dialog closes once it succeeds. */
export interface CashSettingsDialogProps {
	ownerChoice?: CashSettingsOwnerChoice;
	cashAccounts: Account[];
	cardAccounts: Account[];
	settings: CashSettings;
	formatter: Formatter;
	onSave(settings: SavedCashSettings): Promise<void>;
	onClose(): void;
}

interface AccountSwitchesProps {
	accounts: Account[];
	chosenIds: ReadonlySet<string>;
	emptyText: string;
	warningFor?(account: Account): string | null;
	onMove?(index: number, by: number): void;
	onToggle(accountId: string, isChosen: boolean): void;
}

interface MoveButtonsProps {
	label: string;
	index: number;
	count: number;
	onMove(index: number, by: number): void;
}

/** Lets the household choose which cash accounts are checking or reserves, which cards count and in what order, the cushion, and the safety days. */
export function CashSettingsDialog({ ownerChoice, cashAccounts, cardAccounts, settings, formatter, onSave, onClose }: CashSettingsDialogProps) {
	const [roles, setRoles] = useState<ReadonlyMap<string, CashRole>>(() => new Map(cashAccounts.map(account => [account.id, savedRoleOf(account.id, settings)])));
	const idsWithRole = (role: CashRole) => cashAccounts.filter(account => roles.get(account.id) === role).map(account => account.id);
	const checkingIds = new Set(idsWithRole('checking'));
	const [cardIds, setCardIds] = useState<ReadonlySet<string>>(() => new Set(settings.cardAccountIds));
	const [orderedCards, setOrderedCards] = useState(() => chosenFirst(cardAccounts, settings.cardAccountIds));
	const [cushion, setCushion] = useState<number | null>(settings.cushion);
	const [safetyDays, setSafetyDays] = useState(settings.safetyDays);
	// Include a saved value this version doesn't offer, such as one from a newer Wingspan, so opening the dialog doesn't change it.
	const safetyOptions: SelectOption<string>[] = [...new Set<number>([...SAFETY_DAY_CHOICES, settings.safetyDays])].sort((a, b) => a - b).map(days => [String(days), `${days} days`]);
	const [isSaving, setIsSaving] = useState(false);
	const cushionAmount = cushion ?? 0;
	const checkingProblem = checkingIds.size === 0 ? 'Choose at least one checking account.' : null;
	const cushionProblem = !Number.isFinite(cushionAmount) || cushionAmount < 0 ? "The amount to keep can't be less than $0." : null;
	const isValid = checkingProblem === null && cushionProblem === null;
	const checkingNow = cashAccounts.filter(account => checkingIds.has(account.id)).reduce((total, account) => total + (account.currentBalance ?? 0), 0);
	const cushionNote =
		cushionProblem ??
		(checkingIds.size > 0 && cushionAmount > checkingNow ? `This is more than checking has now (${formatter.money(checkingNow)}), so there's no free cash until checking reaches it.` : null);
	const saveSettings = async () => {
		setIsSaving(true);
		try {
			await onSave({
				checkingAccountIds: [...checkingIds],
				cardAccountIds: orderedCards.filter(account => cardIds.has(account.id)).map(account => account.id),
				knownCardAccountIds: orderedCards.map(account => account.id),
				reserveAccountIds: idsWithRole('reserve'),
				cushion: cushionAmount,
				safetyDays
			});
			onClose();
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog
			title="Cash and cards"
			onClose={onClose}
			actions={
				<>
					<Button onClick={onClose}>Cancel</Button>
					<Button variant="primary" disabled={!isValid} loading={isSaving} onClick={saveSettings}>
						Save
					</Button>
				</>
			}
		>
			<FormGrid>
				{ownerChoice ? (
					<Field label="Settings for">
						<Select options={ownerChoice.options} value={ownerChoice.value} label="Settings for" onChange={ownerChoice.onChange} />
					</Field>
				) : null}
				<Fieldset legend="Cash accounts" wide>
					{cashAccounts.length ? (
						<div className="flex flex-col gap-sm">
							{cashAccounts.map(account => (
								<div key={account.id} className="flex w-full items-center justify-between gap-md">
									<span className="min-w-0 flex-1 truncate text-base font-book text-content-primary">{account.displayName}</span>
									<div className="w-40 shrink-0">
										<Select
											options={CASH_ROLES}
											value={roles.get(account.id) ?? 'none'}
											label={`${account.displayName} counts as`}
											onChange={role => setRoles(current => new Map(current).set(account.id, role))}
										/>
									</div>
								</div>
							))}
						</div>
					) : (
						<span className="text-sm font-book text-content-secondary">No cash accounts in Monarch.</span>
					)}
					{checkingProblem ? (
						<p className="my-0 text-xs text-content-danger" role="status">
							{checkingProblem}
						</p>
					) : null}
					<p className="my-0 text-xs text-content-secondary">When checking runs low, Wingspan borrows on the cards first, then draws from reserves, then uses the amount you always keep.</p>
				</Fieldset>
				<Field label="Always keep">
					<MoneyInput value={cushion} step={CUSHION_STEP} formatter={formatter} onChange={setCushion} />
					{cushionNote ? (
						<p className={`my-0 text-xs ${cushionProblem ? 'text-content-danger' : 'text-content-warning'}`} role="status">
							{cushionNote}
						</p>
					) : null}
				</Field>
				<Field label="Keep free cash safe for">
					<Select options={safetyOptions} value={String(safetyDays)} label="Keep free cash safe for" onChange={days => setSafetyDays(Number(days))} />
					<p className="my-0 text-xs text-content-secondary">
						Free cash leaves enough to cover the amount you keep, every bill, and each card payment this far ahead, or until the next paycheck if that's later.
					</p>
				</Field>
				<Fieldset legend="Cards counted as debt, borrowed on in order from the top" wide>
					<AccountSwitches
						accounts={orderedCards}
						chosenIds={cardIds}
						emptyText="No cards in Monarch."
						warningFor={missingTermsWarning}
						onMove={(index, by) => setOrderedCards(current => moved(current, index, by))}
						onToggle={(accountId, isChosen) => setCardIds(toggled(cardIds, accountId, isChosen))}
					/>
				</Fieldset>
			</FormGrid>
		</Dialog>
	);
}

function AccountSwitches({ accounts, chosenIds, emptyText, warningFor, onMove, onToggle }: AccountSwitchesProps) {
	const [moveAnnouncement, setMoveAnnouncement] = useState('');
	if (!accounts.length) return <span className="text-sm font-book text-content-secondary">{emptyText}</span>;
	const move = (index: number, by: number) => {
		const account = accounts[index];
		if (!onMove || !account) return;
		onMove(index, by);
		setMoveAnnouncement(`${account.displayName} moved to ${index + by + 1} of ${accounts.length}.`);
	};
	return (
		<div className="flex flex-col gap-sm">
			{accounts.map((account, index) => {
				const warning = warningFor?.(account) ?? null;
				return (
					<SwitchRow
						key={account.id}
						label={account.displayName}
						checked={chosenIds.has(account.id)}
						adornment={
							<>
								<span className="inline-flex w-6 shrink-0 justify-center">{warning ? <Warning text={warning} /> : null}</span>
								{onMove ? <MoveButtons label={account.displayName} index={index} count={accounts.length} onMove={move} /> : null}
							</>
						}
						onChange={isChosen => onToggle(account.id, isChosen)}
					/>
				);
			})}
			{onMove ? (
				<span role="status" className="sr-only">
					{moveAnnouncement}
				</span>
			) : null}
		</div>
	);
}

/** When a row reaches the top or bottom, focus moves to its other arrow, since the pressed one is now disabled. */
function MoveButtons({ label, index, count, onMove }: MoveButtonsProps) {
	const upRef = useRef<HTMLButtonElement>(null);
	const downRef = useRef<HTMLButtonElement>(null);
	const pressedRef = useRef<'up' | 'down' | null>(null);
	const isFirst = index === 0;
	const isLast = index === count - 1;
	useLayoutEffect(() => {
		if (isFirst && pressedRef.current === 'up') downRef.current?.focus();
		if (isLast && pressedRef.current === 'down') upRef.current?.focus();
		pressedRef.current = null;
	});
	const press = (direction: 'up' | 'down') => {
		pressedRef.current = direction;
		onMove(index, direction === 'up' ? -1 : 1);
	};

	return (
		<span className="flex shrink-0 gap-2xs">
			<button ref={upRef} type="button" className={iconButtonStyles({ size: '2xs' })} aria-label={`Move ${label} up`} disabled={isFirst} style={hiddenWhen(isFirst)} onClick={() => press('up')}>
				<span className="inline-flex rotate-180">
					<ChevronIcon />
				</span>
			</button>
			<button ref={downRef} type="button" className={iconButtonStyles({ size: '2xs' })} aria-label={`Move ${label} down`} disabled={isLast} style={hiddenWhen(isLast)} onClick={() => press('down')}>
				<ChevronIcon />
			</button>
		</span>
	);
}

// Hide a disabled arrow but keep its space, so the arrows line up.
function hiddenWhen(isHidden: boolean): CSSProperties | undefined {
	return isHidden ? { visibility: 'hidden' } : undefined;
}

function Warning({ text }: { text: string }) {
	return (
		<TooltipButton label={text} className="text-content-warning">
			<Icon shape="alert" size={16} />
		</TooltipButton>
	);
}

function missingTermsWarning(card: Account): string | null {
	const notes: string[] = [];
	if (creditLimitOf(card) === null) notes.push("No credit limit, so Wingspan won't borrow on this card when checking runs low, and can't tell when it would max out.");
	if (aprOf(card) === null) notes.push("No APR, so it's paid down after the cards that have one, and starts at the bottom of this list.");
	if (minimumPaymentOf(card) === null) notes.push(`No minimum payment, so Wingspan estimates one: ${ESTIMATED_MINIMUM_RULE}.`);
	return notes.length ? `${notes.join(' ')} Add ${notes.length === 1 ? 'it' : 'them'} in the account's details in Monarch.` : null;
}

function savedRoleOf(accountId: string, settings: CashSettings): CashRole {
	if (settings.checkingAccountIds.includes(accountId)) return 'checking';
	if (settings.reserveAccountIds.includes(accountId)) return 'reserve';
	return 'none';
}

function chosenFirst(accounts: Account[], chosenIds: string[]): Account[] {
	const accountsById = new Map(accounts.map(account => [account.id, account]));
	const chosen = chosenIds.flatMap(accountId => accountsById.get(accountId) ?? []);
	return [...chosen, ...accounts.filter(account => !chosenIds.includes(account.id))];
}

function moved<T>(items: readonly T[], index: number, by: number): T[] {
	const next = [...items];
	const [item] = next.splice(index, 1);
	if (item !== undefined) next.splice(index + by, 0, item);
	return next;
}

function toggled(ids: ReadonlySet<string>, accountId: string, isChosen: boolean): ReadonlySet<string> {
	const next = new Set(ids);
	if (isChosen) next.add(accountId);
	else next.delete(accountId);
	return next;
}
