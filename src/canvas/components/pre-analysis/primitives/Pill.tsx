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
import { typography } from '@/styles/typography'

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

// All variants: outlined (bg-transparent border), no filled backgrounds (DS v3.1)
const variantStyles: Record<PillVariant, string> = {
  default: 'border-factor/30 text-text-body',
  info: 'border-info/30 text-text-body',
  success: 'border-success/30 text-text-body',
  warning: 'border-warning/30 text-text-body',
  danger: 'border-danger/30 text-text-body',
}

const sizeStyles: Record<PillSize, string> = {
  small: `px-2 py-0.5 ${typography.panelMeta}`,
  regular: `px-3 py-1 ${typography.panelBody}`,
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
        inline-flex items-center rounded-full bg-transparent border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

export default Pill
