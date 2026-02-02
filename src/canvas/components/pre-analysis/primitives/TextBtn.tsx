/**
 * TextBtn - Inline text button with underline
 *
 * Used for "View all improvements" style links.
 * Renders as underlined text that acts as a button.
 */

import type { ReactNode } from 'react'

interface TextBtnProps {
  /** Button content */
  children: ReactNode
  /** Click handler */
  onClick?: () => void
  /** Disabled state */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

export function TextBtn({
  children,
  onClick,
  disabled = false,
  className = '',
}: TextBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        text-sm text-info underline hover:text-info-hover transition-colors
        disabled:text-text-light disabled:no-underline disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  )
}

export default TextBtn
