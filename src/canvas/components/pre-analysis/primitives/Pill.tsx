/**
 * Pill - Small badge/tag component
 *
 * Two size variants:
 * - small: padding 2px 8px (compact inline use)
 * - regular: padding 4px 12px (standard use)
 *
 * Uses 999px border-radius for pill shape.
 */

import type { ReactNode } from 'react'

type PillVariant = 'default' | 'info' | 'success' | 'warning' | 'danger'
type PillSize = 'small' | 'regular'

interface PillProps {
  /** Content to display */
  children: ReactNode
  /** Visual variant */
  variant?: PillVariant
  /** Size variant */
  size?: PillSize
  /** Show border */
  bordered?: boolean
  /** Additional class names */
  className?: string
}

const variantStyles: Record<PillVariant, string> = {
  default: 'bg-factor-light text-text-body',
  info: 'bg-info-light text-info',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
}

const borderStyles: Record<PillVariant, string> = {
  default: 'border-factor/30',
  info: 'border-info/30',
  success: 'border-success/30',
  warning: 'border-warning/30',
  danger: 'border-danger/30',
}

const sizeStyles: Record<PillSize, string> = {
  small: 'px-2 py-0.5 text-xs',
  regular: 'px-3 py-1 text-sm',
}

export function Pill({
  children,
  variant = 'default',
  size = 'regular',
  bordered = false,
  className = '',
}: PillProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${bordered ? `border ${borderStyles[variant]}` : ''}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

export default Pill
