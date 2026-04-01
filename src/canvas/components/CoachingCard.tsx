/**
 * CoachingCard — contextual coaching card rendered inside node bodies.
 * Design System v5: bg-panel border border-{colour}/30 rounded-lg.
 * Uses guidanceStore._dispatchAction for chip actions with proper metadata.
 */
import { memo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'

interface CoachingCardChip {
  label: string
  message: string
  /** Optional deterministic action type for CEE routing */
  action_type?: string
  /** Optional structured parameters */
  parameters?: Record<string, unknown>
}

interface CoachingCardProps {
  severity: 'info' | 'warning' | 'danger'
  message: string
  linkLabel?: string
  linkMessage?: string
  chips?: CoachingCardChip[]
}

export const CoachingCard = memo(({
  severity,
  message,
  linkLabel,
  linkMessage,
  chips,
}: CoachingCardProps) => {
  const handleChipAction = useCallback((chip: CoachingCardChip) => {
    const dispatch = useGuidanceStore.getState()._dispatchAction
    if (dispatch) {
      dispatch({
        action_type: chip.action_type,
        parameters: chip.parameters,
        label: chip.label,
        message: chip.message,
        source: 'canvas_coaching',
      })
    } else {
      // Fallback: use _sendMessage if _dispatchAction not yet registered
      const send = useGuidanceStore.getState()._sendMessage
      if (send) send(chip.message)
      if (import.meta.env.DEV) console.warn('[CoachingCard] _dispatchAction not registered, falling back to _sendMessage')
    }
  }, [])

  const handleLinkAction = useCallback((label: string, msg: string) => {
    const dispatch = useGuidanceStore.getState()._dispatchAction
    if (dispatch) {
      dispatch({ label, message: msg, source: 'canvas_coaching' })
    } else {
      const send = useGuidanceStore.getState()._sendMessage
      if (send) send(msg)
    }
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
                  handleLinkAction(linkLabel, linkMessage)
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
                handleChipAction(chip)
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
