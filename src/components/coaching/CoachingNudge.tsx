/**
 * Coaching Nudge Component
 * Displays contextual AI coaching suggestions to improve decision models
 * Week 3: CEE-Powered Coaching
 */

import { memo, useState, useCallback } from 'react'
import { Lightbulb, X, ChevronRight } from 'lucide-react'
import styles from './CoachingNudge.module.css'

export interface NudgeData {
  id: string
  type: 'bias' | 'assumption' | 'improvement' | 'missing_factor'
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
}

interface CoachingNudgeProps {
  nudge: NudgeData
}

export const CoachingNudge = memo(function CoachingNudge({ nudge }: CoachingNudgeProps) {
  const [isDismissing, setIsDismissing] = useState(false)

  const handleDismiss = useCallback(() => {
    setIsDismissing(true)
    // Allow animation to complete
    setTimeout(() => {
      nudge.onDismiss()
    }, 200)
  }, [nudge])

  const handleAction = useCallback(() => {
    nudge.onAction()
    handleDismiss()
  }, [nudge, handleDismiss])

  const severityIcon = {
    high: '!',
    medium: '?',
    low: 'i',
  }

  return (
    <div
      className={`${styles.nudge} ${styles[nudge.severity]} ${isDismissing ? styles.dismissing : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className={styles.iconWrapper}>
        <div className={`${styles.icon} ${styles[`icon${nudge.severity.charAt(0).toUpperCase()}${nudge.severity.slice(1)}`]}`}>
          <Lightbulb size={20} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.label}>Olumi noticed</span>
          <span className={`${styles.badge} ${styles[`badge${nudge.severity.charAt(0).toUpperCase()}${nudge.severity.slice(1)}`]}`}>
            {nudge.type.replace('_', ' ')}
          </span>
        </div>

        <p className={styles.message}>{nudge.message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleAction}
            className={styles.primaryAction}
          >
            {nudge.actionLabel}
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className={styles.secondaryAction}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className={styles.closeButton}
        aria-label="Dismiss suggestion"
      >
        <X size={16} />
      </button>
    </div>
  )
})

CoachingNudge.displayName = 'CoachingNudge'
