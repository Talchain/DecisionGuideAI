/**
 * OlumiSparkle — small sparkle icon indicating an AI-estimated value.
 * Tooltip: "Estimated by Olumi".
 */
import { Sparkles } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'

export function OlumiSparkle() {
  return (
    <Tooltip content="Estimated by Olumi" delay={200}>
      <span className="inline-flex cursor-help" title="Estimated by Olumi">
        <Sparkles size={10} className="text-text-light" aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
