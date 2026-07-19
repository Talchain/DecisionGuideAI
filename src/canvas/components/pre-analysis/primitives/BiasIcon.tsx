/**
 * BiasIcon - Cognitive bias indicator with tooltip
 *
 * Four bias types with rule-based classification:
 * - Anchoring (Anchor icon): Missing baseline
 * - Framing (Frame icon): ≤2 options
 * - Confidence (Gauge icon): AI-estimated value (source === 'cee_inference')
 * - Blind spots (EyeOff icon): No constraints, no risks, or no negative edges
 *
 * Always rendered in #6E6B6B (text-light).
 * Tooltip on hover: "{plain-English why} · {Bias category name}"
 */

import { Anchor, Frame, Gauge, EyeOff } from 'lucide-react'
import { Tooltip } from '../../../components/Tooltip'

export type BiasType = 'anchoring' | 'framing' | 'confidence' | 'blind_spots'

interface BiasIconProps {
  /** Type of cognitive bias */
  bias: BiasType
  /** Plain-English explanation of why this bias applies */
  why: string
  /** Additional class names */
  className?: string
}

const biasConfig: Record<BiasType, { icon: typeof Anchor; label: string }> = {
  anchoring: { icon: Anchor, label: 'Anchoring bias' },
  framing: { icon: Frame, label: 'Framing bias' },
  confidence: { icon: Gauge, label: 'Confidence bias' },
  blind_spots: { icon: EyeOff, label: 'Blind spots' },
}

export function BiasIcon({ bias, why, className = '' }: BiasIconProps) {
  const config = biasConfig[bias]
  const Icon = config.icon
  const tooltipContent = `${why} · ${config.label}`

  return (
    <Tooltip content={tooltipContent}>
      <span
        className={`inline-flex items-center text-text-light ${className}`}
        aria-label={tooltipContent}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
    </Tooltip>
  )
}

export default BiasIcon
