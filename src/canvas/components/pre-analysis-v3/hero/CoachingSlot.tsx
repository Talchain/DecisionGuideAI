/**
 * CoachingSlot — reserved CEE enrichment slot in the hero.
 *
 * Renders only when coaching text is live in session (draftCoaching summary
 * or analysis_ready coaching_summary), verbatim and attributed. The slot
 * reserves no height when empty and animates opacity only, so its arrival
 * never shifts the fields or the ladder (progressive rendering).
 *
 * ── WHY THE TEXT GOES THROUGH `richTextNodes` ──────────────────────────────
 * ⭐ ONE PRODUCER STRING, TWO SURFACES, AND THEY DISAGREED ABOUT MARKUP.
 * `pickAssumption()` feeds BOTH the conversation bullet and
 * `analysis_ready.coaching_summary`, which lands here. The conversation
 * renders the estate's markdown dialect; this slot rendered `{coaching.text}`
 * as a plain React child. So a sentence CEE marked for the conversation —
 * under the rule "mark what goes to the conversation" — read as prose there
 * and as LITERAL ASTERISKS in this pre-analysis receipt.
 *
 * That was not hypothetical: the CEE lane marked twelve sites and had to
 * REVERT this one, because the UI could not render what it would send. The
 * revert was right given this component; the component was the reason.
 *
 * ⚠ AND NOT VIA `dangerouslySetInnerHTML`, WHICH THIS SUBTREE BANS. The v3
 * directory carries a source-scan guard forbidding that prop outright
 * (`signals/__tests__/registry.spec.ts`). The ban is deliberate, so the fix is
 * not an exemption from it — `richTextNodes` walks `safeRichText`'s sanitised
 * output into REACT ELEMENTS, so no HTML string is ever injected here. That is
 * a stronger safety property than the conversation surfaces have, not a
 * weaker one.
 *
 * ⚠ THE ATTRIBUTION STAYS A PLAIN REACT CHILD, DELIBERATELY. `displayName` is
 * collaborator-supplied, not producer prose, and it is not markdown; it keeps
 * React's automatic escaping and is never routed through the renderer.
 *
 * ⚠ UNMARKED COPY IS BYTE-IDENTICAL. `richTextNodes` returns the string itself
 * when nothing was marked, so every existing fixture renders exactly as
 * before: this widens what CAN render, it does not restyle what already did.
 */

import { memo } from 'react'
import { Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { richTextNodes } from '../../../utils/richTextNodes'
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
      className="mt-4 flex items-start gap-2"
      data-testid="pre-analysis-v3-coaching-slot"
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-info" aria-hidden />
      <p className={`${typography.panelBody} text-text-body`}>
        <span className="font-semibold text-info">{who}</span>{' '}
        <span data-testid="pre-analysis-v3-coaching-text">{richTextNodes(coaching.text)}</span>
      </p>
    </div>
  )
})
