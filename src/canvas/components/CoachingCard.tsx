/**
 * CoachingCard — contextual coaching card rendered inside node bodies.
 * Design System v5: bg-panel border border-{colour}/30 rounded-lg.
 * Uses guidanceStore._sendMessage for chip actions.
 */
import { memo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'

interface CoachingCardProps {
  severity: 'info' | 'warning' | 'danger'
  message: string
  linkLabel?: string
  linkMessage?: string
  chips?: Array<{ label: string; message: string }>
}

export const CoachingCard = memo(({
  severity,
  message,
  linkLabel,
  linkMessage,
  chips,
}: CoachingCardProps) => {
  const sendMessage = useCallback((text: string) => {
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(text)
  }, [])

  const borderColour = severity === 'warning' ? 'border-warning/30'
    : severity === 'danger' ? 'border-danger/30'
    : 'border-info/30'
  const iconColour = severity === 'warning' ? 'text-warning'
    : severity === 'danger' ? 'text-danger'
    : 'text-info'

  return (
    <div className={`bg-panel border ${borderColour} rounded-lg px-2.5 py-2 mt-1.5 flex flex-col gap-1.5`}>
      <div className="flex items-start gap-1.5">
        <Sparkles size={12} className={`${iconColour} shrink-0 mt-0.5`} aria-hidden="true" />
        <span className={`${typography.nodeLabel} text-text-secondary leading-snug`}>
          {message}
          {linkLabel && linkMessage && (
            <>
              {' '}
              <button
                type="button"
                className={`${typography.nodeLabel} text-info underline cursor-pointer nodrag nopan`}
                onClick={(e) => {
                  e.stopPropagation()
                  sendMessage(linkMessage)
                }}
              >
                {linkLabel}
              </button>
            </>
          )}
        </span>
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {chips.map((chip, i) => (
            <button
              key={i}
              type="button"
              className={`${typography.nodeLabel} bg-transparent border border-info/30 text-text-body rounded-full px-2 py-0.5 cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                sendMessage(chip.message)
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

CoachingCard.displayName = 'CoachingCard'
