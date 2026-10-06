import { Input as BaseInput } from '@base-ui/react/input';
import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import { type ComponentProps, type MouseEvent, useRef } from 'react';
import type { Formatter } from '../formatter';
import { useMonarchTheme } from '../hooks/useMonarchTheme';
import { inputGroupStyles, textInputStyles } from '../styles';

/** A 36px (`sm`) or 40px (`md`) input. */
export type InputSize = 'sm' | 'md';

/** A native input's props, with `onChange` given the new text. */
export type TextInputProps = Omit<ComponentProps<typeof BaseInput>, 'className' | 'onChange' | 'onValueChange' | 'value' | 'size'> & {
	value: string;
	onChange(value: string): void;
};

/** `null` is an empty input. `step` defaults to any amount. */
export interface MoneyInputProps {
	value: number | null;
	size?: InputSize;
	step?: number;
	placeholder?: string;
	label?: string;
	formatter: Formatter;
	onChange(value: number | null): void;
}

export function TextInput({ onChange, ...inputAttributes }: TextInputProps) {
	const theme = useMonarchTheme();
	// Native date and time pickers draw their icons from color-scheme, which Monarch doesn't set.
	const style = inputAttributes.type === 'date' ? { colorScheme: theme } : undefined;

	return <BaseInput data-mds="input" className={textInputStyles()} style={style} onValueChange={inputValue => onChange(String(inputValue))} {...inputAttributes} />;
}

/** Monarch's dollar amount input. It formats the amount as currency and doesn't allow negatives. */
export function MoneyInput({ value, size, step, placeholder, label, formatter, onChange }: MoneyInputProps) {
	const inputGroupSlots = inputGroupStyles({ size });
	const inputRef = useRef<HTMLInputElement>(null);

	const focusInput = (event: MouseEvent<HTMLDivElement>) => {
		if (event.target === inputRef.current) return;

		event.preventDefault();
		inputRef.current?.focus();
	};

	return (
		<BaseNumberField.Root
			className="contents"
			value={value}
			onValueChange={numberValue => onChange(numberValue)}
			min={0}
			step={step ?? 'any'}
			locale={formatter.locale}
			format={{ style: 'currency', currency: formatter.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }}
		>
			<div role="group" data-mds="input-group" className={inputGroupSlots.root()} onMouseDown={focusInput}>
				<BaseNumberField.Input
					ref={inputRef}
					data-mds="currency-input"
					data-input-group-control=""
					aria-label={label}
					className={inputGroupSlots.input()}
					placeholder={placeholder ?? formatter.money(0)}
				/>
			</div>
		</BaseNumberField.Root>
	);
}
