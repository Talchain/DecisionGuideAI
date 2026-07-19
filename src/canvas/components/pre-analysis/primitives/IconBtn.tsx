/**
 * IconBtn - icon button with tooltip
 *
 * Visual size: 28×28 (w-7 h-7). Touch target: 44×44 min via transparent
 * padding area around the visual button (DS v5 §6 minimum touch target).
 *
 * Variants:
 * - default: Standard icon button
 * - confirm: Confirmation action
 * - edit: Edit action
 * - assume: Assumption action
 * - primary: Primary action style
 * - ghost: Minimal/transparent style
 *
 * All action variants are now enabled with proper handlers.
 */

import type { ElementType } from 'react'
import { Tooltip } from '../../../components/Tooltip'

type IconBtnVariant = 'default' | 'confirm' | 'edit' | 'assume' | 'primary' | 'ghost'

interface IconBtnProps {
  /** Lucide icon component */
  icon: ElementType
  /** Tooltip text on hover */
  tooltip: string
  /** Button variant */
  variant?: IconBtnVariant
  /** Click handler */
  onClick?: () => void
  /** Force disabled state */
  disabled?: boolean
  /** Aria label override */
  ariaLabel?: string
  /** Additional class names */
  className?: string
}

const variantStyles: Record<IconBtnVariant, { enabled: string; disabled: string }> = {
  default: {
    enabled: 'text-text-light hover:text-text-body hover:bg-panel-hover',
    disabled: 'text-text-light cursor-not-allowed',
  },
  confirm: {
    enabled: 'text-success hover:bg-panel-hover',
    disabled: 'text-text-light cursor-not-allowed',
  },
  edit: {
    enabled: 'text-info hover:bg-panel-hover',
    disabled: 'text-text-light cursor-not-allowed',
  },
  assume: {
    enabled: 'text-warning hover:bg-panel-hover',
    disabled: 'text-text-light cursor-not-allowed',
  },
  primary: {
    enabled: 'text-info hover:bg-panel-hover',
    disabled: 'text-text-light cursor-not-allowed',
  },
  ghost: {
    enabled: 'text-text-light hover:text-text-body',
    disabled: 'text-text-light cursor-not-allowed',
  },
}

export function IconBtn({
  icon: Icon,
  tooltip,
  variant = 'default',
  onClick,
  disabled = false,
  ariaLabel,
  className = '',
}: IconBtnProps) {
  const styles = variantStyles[variant]
  const buttonStyle = disabled ? styles.disabled : styles.enabled

  const handleClick = () => {
    if (!disabled) {
      onClick?.()
    }
  }

  // Touch target: visual stays w-7 h-7 (28px), but an absolutely positioned
  // ::before pseudo-element extends the clickable area to 44×44 px.
  const touchTarget = 'relative before:absolute before:inset-[-8px] before:content-[""]'

  // Wrap disabled buttons in a span so tooltip hover events still fire
  // (disabled buttons don't receive pointer events)
  if (disabled) {
    return (
      <Tooltip content={tooltip}>
        <span className="inline-flex" tabIndex={0} aria-label={ariaLabel ?? tooltip}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className={`
              ${touchTarget} w-7 h-7 flex items-center justify-center rounded-full transition-colors opacity-40
              ${buttonStyle}
              ${className}
            `}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel ?? tooltip}
        className={`
          ${touchTarget} w-7 h-7 flex items-center justify-center rounded-full transition-colors
          ${buttonStyle}
          ${className}
        `}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

export default IconBtn
