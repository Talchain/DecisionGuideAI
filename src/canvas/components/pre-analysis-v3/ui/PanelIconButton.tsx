/**
 * PanelIconButton — small icon affordance used across the v3 panel.
 *
 * 28px square: a documented panel exception to the 44px touch-target rule,
 * consistent with the existing inspector affordances. Always paired with an
 * aria-label and a Tooltip (hover + focus) at the call site.
 *
 * Variants (three-channel: icons say what you can do, colour says state):
 * - ghost: quiet grey, darkens on hover/focus
 * - ai:    info-coloured ask-Olumi spark
 * - go:    primary action (info blue fill, white icon)
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'ghost' | 'ai' | 'go'

const VARIANT_CLASSES: Record<Variant, string> = {
  ghost:
    'text-text-light hover:text-text-header hover:bg-panel-hover focus-visible:text-text-header focus-visible:bg-panel-hover',
  ai: 'text-info hover:bg-panel-hover focus-visible:bg-panel-hover',
  go: 'bg-primary text-text-on-color hover:bg-primary-hover focus-visible:bg-primary-hover',
}

interface PanelIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Required — icon-only buttons must name their action. */
  'aria-label': string
}

export const PanelIconButton = forwardRef<HTMLButtonElement, PanelIconButtonProps>(
  function PanelIconButton({ variant = 'ghost', className = '', type, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-info/40 disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
        {...rest}
      />
    )
  },
)
