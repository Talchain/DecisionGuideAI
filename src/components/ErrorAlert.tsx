/**
 * ErrorAlert - Branded error message component
 *
 * Design: Carrot/sun backgrounds with appropriate text colors
 * Usage: Error states, validation feedback, warning messages
 */

import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { typography } from '../styles/typography'

interface ErrorAlertProps {
  title?: string
  message: string
  severity?: 'error' | 'warning' | 'info'
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  /** Debug details shown in POC mode - error codes, correlation IDs, etc. */
  debugInfo?: string
}

const severityConfig = {
  error: {
    bg: 'bg-carrot-50',
    border: 'border-carrot-200',
    text: 'text-carrot-900',
    textMuted: 'text-carrot-700',
    icon: AlertCircle,
    iconColor: 'text-carrot-600',
  },
  warning: {
    bg: 'bg-sun-50',
    border: 'border-sun-200',
    text: 'text-sun-900',
    textMuted: 'text-sun-700',
    icon: AlertTriangle,
    iconColor: 'text-sun-600',
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-900',
    textMuted: 'text-sky-700',
    icon: Info,
    iconColor: 'text-sky-600',
  },
}

export function ErrorAlert({
  title,
  message,
  severity = 'error',
  action,
  className = '',
  debugInfo,
}: ErrorAlertProps) {
  const config = severityConfig[severity]
  const Icon = config.icon

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-3 ${className}`}
      role="alert"
      aria-live="polite"
      data-testid={`error-alert-${severity}`}
    >
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1 space-y-1">
          {title && (
            <h3 className={`${typography.label} ${config.text} font-semibold`}>
              {title}
            </h3>
          )}
          <p className={`${typography.caption} ${config.textMuted}`}>
            {message}
          </p>
          {/* Debug info for POC mode - helps developers understand errors */}
          {debugInfo && (
            <p className={`${typography.caption} ${config.textMuted} font-mono text-xs mt-1 opacity-70`}>
              {debugInfo}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 inline-flex items-center px-3 py-1.5 rounded ${typography.caption} font-medium ${config.text} hover:bg-white/50 transition-colors`}
              type="button"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
