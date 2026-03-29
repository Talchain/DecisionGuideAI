/**
 * BiasIcon — small warning icon button with popover showing bias insight + action link.
 * Used inline with chips or guidance text on canvas nodes.
 */
import { useState, useCallback } from 'react'
import { Frame, EyeOff, Gauge, Anchor } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useGuidanceStore } from '../../stores/guidanceStore'

type BiasType = 'narrow-framing' | 'status-quo' | 'overconfidence' | 'anchoring'

const BIAS_ICONS = {
  'narrow-framing': Frame,
  'status-quo': EyeOff,
  'overconfidence': Gauge,
  'anchoring': Anchor,
} as const

interface BiasIconProps {
  bias: BiasType
  tip: string
  /** Optional link label shown in the popover */
  linkLabel?: string
  /** Message sent to AI when the link is clicked */
  linkMessage?: string
}

export function BiasIcon({ bias, tip, linkLabel, linkMessage }: BiasIconProps) {
  const [open, setOpen] = useState(false)
  const Icon = BIAS_ICONS[bias]

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(prev => !prev)
  }, [])

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (linkMessage) {
      const send = useGuidanceStore.getState()._sendMessage
      if (send) send(linkMessage)
    }
    setOpen(false)
  }, [linkMessage])

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="p-0.5 rounded bg-warning/10 hover:bg-warning/20 transition-colors nodrag nopan"
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Bias warning"
      >
        <Icon size={11} className="text-warning" />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 z-10 w-44 bg-panel border border-warning/30 rounded-lg p-1.5 shadow-1"
          role="dialog"
          aria-label="Bias insight"
        >
          <p className={`${typography.edgeLabel} text-text-body m-0`}>{tip}</p>
          {linkLabel && linkMessage && (
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1 nodrag nopan`}
              onClick={handleLinkClick}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {linkLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
