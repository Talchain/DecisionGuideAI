/**
 * Button — the DS's one button, as a component instead of a utility recipe.
 *
 * Extracted from the pre-analysis-v3 footer button (PanelFooter.tsx), the
 * cleanest live instance: token typography, pill radius, focus ring,
 * disabled opacity. The DS specifies exactly one primary treatment
 * (bg-primary + text-text-on-color); before this component every surface
 * hand-assembled it from utilities, which is how variants drift.
 *
 * Variants:
 *  - primary   — the single filled treatment (one per view, usually)
 *  - secondary — outlined neutral
 *  - ghost     — borderless text action (info-deep text)
 *  - danger    — outlined danger (never filled; destructive confirm lives in
 *                the dialog, not the button colour)
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { typo } from '../../styles/typography'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-text-on-color hover:bg-primary-hover focus-visible:bg-primary-hover border border-transparent',
  secondary:
    'bg-transparent text-text-body border border-panel-border hover:bg-panel-hover',
  ghost: 'bg-transparent text-info-hover border border-transparent hover:bg-panel-hover',
  danger: 'bg-transparent text-danger-hover border border-danger/40 hover:bg-panel-hover',
}

const SIZE_CLASSES: Record<ButtonSize, { typo: 'button' | 'buttonSmall'; pad: string }> = {
  // Extraction-first: `sm` is PanelFooter's exact geometry (buttonSmall + px-4 py-2).
  md: { typo: 'button', pad: 'px-5 py-2.5' },
  sm: { typo: 'buttonSmall', pad: 'px-4 py-2' },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  const s = SIZE_CLASSES[size]
  return (
    <button
      ref={ref}
      type={type}
      className={typo(
        s.typo,
        `whitespace-nowrap rounded-full ${s.pad} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`,
      )}
      {...rest}
    />
  )
})
