/**
 * Spinner - Branded loading indicator
 *
 * Design: an info-coloured arc icon with smooth rotation animation (DS v5 §6:
 * no one-sided borders, so the arc is drawn by the icon, not a ring with one
 * transparent side)
 * Usage: Loading states, async operations, streaming indicators
 */

import { typography } from '../styles/typography'
import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <Loader2
        className={`${sizeClasses[size]} text-info animate-spin`}
        aria-hidden="true"
      />
      {label && (
        <span className={`${typography.caption} text-ink-900`}>
          {label}
        </span>
      )}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  )
}
