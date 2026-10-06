import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonStyles, classNames } from '../styles';
import { Spinner } from './spinner';

/** Monarch's filled brand button, its outlined button, and the outlined one with red text. */
export type ButtonVariant = 'primary' | 'default' | 'danger';

/** `leading` and `trailing` are icons beside the label. `loading` disables the button and covers its content with a spinner, keeping its width. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	loading?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
}

export function Button({ variant = 'default', loading = false, leading, trailing, children, disabled, className, ...buttonAttributes }: ButtonProps) {
	return (
		<button
			type="button"
			data-mds="button"
			aria-busy={loading || undefined}
			disabled={disabled || loading}
			{...buttonAttributes}
			className={classNames(buttonStyles({ variant }), loading && 'pointer-events-none relative', className)}
		>
			{leading ? (
				<span data-mds="button-icon" className={loading ? 'inline-flex opacity-0' : 'inline-flex'}>
					{leading}
				</span>
			) : null}
			<span data-mds="button-label" className={loading ? 'opacity-0' : undefined}>
				{children}
			</span>
			{trailing ? (
				<span data-mds="button-icon" className={loading ? 'inline-flex opacity-0' : 'inline-flex'}>
					{trailing}
				</span>
			) : null}
			{loading ? (
				<span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
					<Spinner size="xs" color={variant === 'primary' ? 'inverse' : 'neutral'} />
				</span>
			) : null}
		</button>
	);
}
