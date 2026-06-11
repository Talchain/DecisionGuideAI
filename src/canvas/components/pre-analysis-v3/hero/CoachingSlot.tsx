/**
 * CoachingSlot — reserved CEE enrichment slot in the hero.
 *
 * Renders only when coaching text is live in session (draftCoaching summary
 * or analysis_ready coaching_summary), verbatim and attributed. The slot
 * reserves no height when empty and animates opacity only, so its arrival
 * never shifts the fields or the ladder (progressive rendering).
 */

import { memo } from 'react'
import { Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ATTRIBUTION_COPY } from '../constants'
import type { Attribution } from '../types'

interface CoachingSlotProps {
  coaching: { text: string; attribution: Attribution } | null
}

export const CoachingSlot = memo(function CoachingSlot({ coaching }: CoachingSlotProps) {
  if (!coaching) return null
  const who =
    coaching.attribution.kind === 'olumi'
      ? ATTRIBUTION_COPY.olumiPrefix
      : `${coaching.attribution.displayName}:`
  return (
    <div
      className="mt-3 flex items-start gap-2"
      data-testid="pre-analysis-v3-coaching-slot"
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-info" aria-hidden />
      <p className={`${typography.panelBody} text-text-body`}>
        <span className="font-semibold text-info">{who}</span> {coaching.text}
      </p>
    </div>
  )
})
