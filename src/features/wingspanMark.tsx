import { Tooltip } from '../monarch/ui/components/tooltip';

const MARK_SIZE = 12;
const BUTTON_MARK_SIZE = 16;

export interface WingspanMarkProps {
	label?: string;
	/** Faint and gray beside Monarch's text, or a button-sized icon in the color of the button it sits on. */
	tone?: 'faint' | 'onButton';
}

const TONE_CLASS_NAMES = { faint: 'text-content-secondary opacity-60', onButton: 'text-current' };

/** Decorative, so it stays out of accessible names. */
export function WingspanMark({ label = 'Wingspan feature', tone = 'faint' }: WingspanMarkProps) {
	const size = tone === 'onButton' ? BUTTON_MARK_SIZE : MARK_SIZE;
	return (
		<Tooltip label={label}>
			<span data-wingspan-mark="" aria-hidden="true" className={`inline-flex shrink-0 items-center transition-opacity hover:opacity-100 ${TONE_CLASS_NAMES[tone]}`}>
				<svg viewBox="0 0 128 128" width={size} height={size} fill="currentColor" aria-hidden="true">
					<polygon points="64,35 116,17 108,59 76,63 106,85 90,111 64,93 38,111 22,85 52,63 20,59 12,17" />
				</svg>
			</span>
		</Tooltip>
	);
}
