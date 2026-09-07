/**
 * OlumiSparkle — small sparkle icon indicating an AI-estimated value.
 *
 * ⚠ THE DOUBLE TOOLTIP IS FIXED HERE. This component already wrapped its glyph
 * in the shared `Tooltip` AND kept `title="Estimated by Olumi"` on the same
 * span, so hovering it painted the styled bubble and then the OS tooltip on top
 * of it, saying the same four words twice. The native `title` is removed; the
 * accessible name moves to `role="img"` + `aria-label`, which is reachable
 * without hover or focus.
 *
 * The delay moves 200ms → `NODE_TOOLTIP_DELAY_MS` so every node glyph opens on
 * the same beat. A sparkle sitting beside a provenance mark that opened 100ms
 * later read as two unrelated behaviours.
 */
import { Sparkles } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS, NODE_TOOLTIP_WRAPPER } from './nodeTooltip'

export const OLUMI_SPARKLE_LABEL = 'Estimated by Olumi'

export function OlumiSparkle() {
  return (
    <Tooltip content={OLUMI_SPARKLE_LABEL} delay={NODE_TOOLTIP_DELAY_MS} wrapperClassName={NODE_TOOLTIP_WRAPPER}>
      <span
        data-testid="olumi-sparkle"
        role="img"
        aria-label={OLUMI_SPARKLE_LABEL}
        className="inline-flex cursor-help"
      >
        <Sparkles size={10} className="text-text-light" aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
