/**
 * Spinner - Branded loading indicator
 *
 * Design: Sky-500 border with smooth rotation animation
 * Usage: Loading states, async operations, streaming indicators
 */

import { typography } from '../styles/typography'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
}

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <div
        className={`${sizeClasses[size]} border-sky-500 border-t-transparent rounded-full animate-spin`}
        aria-hidden="true"
      />
      {label && (
        <span className={`${typography.caption} text-ink-900/70`}>
          {label}
        </span>
      )}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  )
}
