/**
 * BiasAlertIcon — single warning icon for detected cognitive bias.
 *
 * Renders when bias_detected is non-null. Max one icon (sunk_cost priority
 * handled upstream in extractRealtimeSignals). Uses the existing Tooltip
 * component for hover text. Supports click path for touch devices.
 *
 * Renders only during framing stage (gated by caller via isFramingStage).
 */

import { Anchor } from 'lucide-react'
import { Tooltip } from '../components/Tooltip'

const BIAS_TOOLTIPS: Record<'sunk_cost' | 'anchoring', string> = {
  sunk_cost: 'Past investment is mentioned \u2014 future outcomes matter more than past spend',
  anchoring: 'One number is anchoring this decision \u2014 are there other figures worth considering?',
}

interface BiasAlertIconProps {
  bias: 'sunk_cost' | 'anchoring' | null
}

export function BiasAlertIcon({ bias }: BiasAlertIconProps) {
  if (!bias) return null

  return (
    <Tooltip content={BIAS_TOOLTIPS[bias]} position="bottom">
      <span
        className="inline-flex items-center transition-opacity duration-200"
        data-testid="bias-alert-icon"
        aria-label={BIAS_TOOLTIPS[bias]}
        role="img"
      >
        <Anchor className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
