/**
 * Badge - Small status indicator component
 *
 * Used for confidence levels, importance indicators, etc.
 */

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps): JSX.Element {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-practical-100 text-practical-800 border-practical-300',
    warning: 'bg-creative-100 text-creative-800 border-creative-300',
    error: 'bg-critical-100 text-critical-800 border-critical-300',
    info: 'bg-analytical-100 text-analytical-800 border-analytical-300',
    neutral: 'bg-storm-100 text-storm-800 border-storm-300',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
