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

import type { ElementType, MouseEvent } from 'react'
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
  /**
   * ⭐ FOR A DISCLOSURE TOGGLE. An icon button that opens something must say so
   * to assistive tech: without `aria-expanded` the glyph is the ONLY signal
   * that anything opened, and a glyph is exactly what a screen reader cannot
   * see. Optional, so every existing one-shot consumer is untouched.
   */
  ariaExpanded?: boolean
  /** The region this toggle controls, when it is open. Pairs with `ariaExpanded`. */
  ariaControls?: string
  /**
   * ⚠ ON THE BUTTON, NEVER ON A WRAPPER. A test that finds a wrapper and
   * clicks it does not reach the button's handler, so a testid placed one
   * element out turns every click assertion into a silent no-op.
   */
  testId?: string
  /**
   * Extra `data-*` attributes for the button. Identity joins live here — a row
   * that must be findable by the recommendation it acts on carries that id on
   * the control itself, so a test binds by IDENTITY rather than by position
   * (CLAUDE.md trap 19).
   */
  dataAttrs?: Readonly<Record<string, string>>
  /**
   * ⚠ FOR A BUTTON INSIDE A CLICKABLE ROW. The Model tab's rows are
   * `role="option"` with their own `onClick`, so an act inside one must stop
   * its click reaching the row, or confirming a value would also select the
   * row. The text buttons this primitive replaced there each called
   * `e.stopPropagation()`; `onClick` here takes no event, so the primitive does
   * it. Optional and off by default, so every existing consumer is untouched.
   */
  stopPropagation?: boolean
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
  ariaExpanded,
  ariaControls,
  testId,
  dataAttrs,
  stopPropagation = false,
}: IconBtnProps) {
  const styles = variantStyles[variant]
  const buttonStyle = disabled ? styles.disabled : styles.enabled

  /**
   * ⛔ `??` FALLS BACK ON null/undefined ONLY — AN EMPTY STRING IS A VALUE.
   *
   * Both name sites read `ariaLabel ?? tooltip`, so a consumer passing a label
   * built from DATA shipped `aria-label=""` the moment that data was empty: a
   * round, pressable, entirely unreachable control that every shape and style
   * assertion applauds. Found by an independent reviewer on the Reasoning
   * panel's intervention act, whose label is producer-supplied.
   *
   * ⚠ THIS HARDENS THE PRIMITIVE; IT DOES NOT ABSOLVE THE CALL SITE. Where a
   * consumer passes the SAME empty value as both label and tooltip there is
   * nothing here to fall back to, so an act that cannot be named must not be
   * offered at all — see `DisclosureRow`.
   */
  const accessibleName = (ariaLabel ?? '').trim() || tooltip

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation()
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
        <span className="inline-flex" tabIndex={0} aria-label={accessibleName}>
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
        aria-label={accessibleName}
        {...(ariaExpanded === undefined ? {} : { 'aria-expanded': ariaExpanded })}
        {...(ariaControls ? { 'aria-controls': ariaControls } : {})}
        {...(testId ? { 'data-testid': testId } : {})}
        {...(dataAttrs ?? {})}
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
