/**
 * EvidenceGapBadge — small "?" indicator on factor nodes with no observed data.
 *
 * Positioned absolute bottom-right of the FactorNode outer wrapper, below the
 * existing NodeBadge system which occupies top-right inside BaseNode.
 *
 * The visual badge is pointer-events-none so it never intercepts node drag/click.
 * A slightly larger transparent hover zone sits on top to make the native title
 * tooltip accessible on hover without interfering with drag.
 *
 * Feature-gated by VITE_FEATURE_GRAPH_BADGES / localStorage['feature.graphBadges'].
 *
 * Post-analysis escalation (A.9): when the factor has high VoI, the badge
 * escalates visually (colour shift + pulse animation). The pulse respects
 * prefers-reduced-motion per DS v5 §7.6.
 */

import { memo } from 'react'
import { typography } from '../../styles/typography'
import {
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_CORNER_OFFSET_CLASSES,
} from './shared/canvasGlyphScale'

export type EvidenceGapEscalation = 'none' | 'warning' | 'critical'

interface EvidenceGapBadgeProps {
  /** Human-readable label of the factor, used in the accessible tooltip. */
  label: string
  /** Post-analysis escalation level based on VoI. Default 'none'. */
  escalation?: EvidenceGapEscalation
}

/** Border + text colour classes by escalation level */
const ESCALATION_STYLES: Record<EvidenceGapEscalation, { border: string; text: string; bg: string }> = {
  none:     { border: 'border-warning/50', text: 'text-warning', bg: 'bg-panel' },
  warning:  { border: 'border-warning',    text: 'text-warning', bg: 'bg-warning-light' },
  critical: { border: 'border-danger',     text: 'text-danger',  bg: 'bg-danger-light' },
}

const ESCALATION_TOOLTIP: Record<EvidenceGapEscalation, string> = {
  none:     'Setting a value would strengthen the analysis.',
  warning:  'High investigation value — gathering evidence here would improve the analysis.',
  critical: 'Critical evidence gap — this is a top factor where better data could change the result.',
}

/**
 * 12px circle badge indicating the factor has no observed data.
 * Appears at bottom-right of the FactorNode outer wrapper.
 *
 * ⭐⭐ THE WORST-MEASURED ELEMENT ON THE DEPLOYED BOARD, AND WHY IT NEEDED TWO
 * FIXES RATHER THAN ONE.
 *
 * The "?" was declared at **7px** and reached the user at **3.5px** on the
 * default whole-model view — node DOM sits inside React Flow's viewport
 * transform and a post-draft auto-fit parks at `LABEL_LEGIBLE_ZOOM` (0.50).
 * `canvasTextCounterScale.census` had it pinned as
 * `nodes/EvidenceGapBadge.tsx:inline-7` with the note that it *"needs a size
 * ruling, not a counter-scale"* — because 7px is below DS v5 §2.4's 10px canvas
 * floor even at zoom 1, so counter-scaling alone would have delivered a
 * faithful 7px that is still too small to read.
 *
 * Both, then, and in the order the census prescribed: the raw inline
 * `fontSize: '7px'` becomes `typography.edgeLabel` — the smallest CANVAS token,
 * 10px, which clears the floor AND carries `--canvas-label-scale` — so the
 * glyph goes 3.5px → 10px. The census pin is removed with this change, which is
 * the whole value of its being asserted exactly.
 *
 * ⚠ THE OFFSETS SCALE WITH THE SIZES, OR THE TWO ELEMENTS COME APART. The
 * circle is centred on the card's corner by `bottom/right: -6px` — correct only
 * while the circle is 12px — and the focus target is centred on the SAME point
 * by its own half-size offset. Scale one and not the other and the transparent
 * target slides off the mark it is supposed to be a target FOR.
 *
 * ⚠ THE TARGET IS 24px NOW, NOT 20. It is `tabIndex={0}`, so it is a real stop
 * in the tab order and owes WCAG 2.2 AA 2.5.8's minimum; it was delivering
 * **10px**. Nothing neighbours it, so the enlargement costs no separation.
 */
export const EvidenceGapBadge = memo(function EvidenceGapBadge({
  label,
  escalation = 'none',
}: EvidenceGapBadgeProps) {
  const tooltip = `No observed data for "${label}". ${ESCALATION_TOOLTIP[escalation]}`
  const styles = ESCALATION_STYLES[escalation]
  const shouldPulse = escalation !== 'none'

  return (
    <>
      {/* Visual badge — pointer-events-none for drag safety */}
      <div
        className={`absolute ${CANVAS_CORNER_OFFSET_CLASSES[6]} ${CANVAS_GLYPH_SIZE_CLASSES[12]} rounded-full border ${styles.border} ${styles.bg}
          flex items-center justify-center pointer-events-none${shouldPulse ? ' evidence-gap-pulse' : ''}`}
        style={{ zIndex: 1 }}
        aria-hidden="true"
        data-testid="evidence-gap-badge"
      >
        <span
          className={`${typography.edgeLabel} ${styles.text} font-bold select-none`}
          aria-hidden="true"
        >
          ?
        </span>
      </div>
      {/* The hover zone — and the ONLY thing that carries this badge's meaning.
          ⚠ `aria-label` ON A BARE `<div>` IS DISCARDED. A `div` with no role
          maps to `role="generic"`, and ARIA forbids a name on a generic
          element — so screen readers dropped this label entirely and the badge
          was, to them, absent. The comment above this said "carries tooltip and
          accessible label"; measured on the deployed build, it carried the
          tooltip only. `role="img"` is the smallest thing that makes a name
          valid here, and it is the honest role: this IS a graphic conveying
          meaning, not a control — there is nothing to activate.
          ⚠ AND THE MEANING WAS MOUSE-ONLY. `title` needs hover, which touch
          does not have, so the escalation ("critical evidence gap — better data
          could change the result") reached only users with a pointer, on a 20px
          transparent target. `tabIndex={0}` puts it in the tab order so a
          keyboard user reaches it and the name is announced; the focus ring is
          what stops that being an invisible stop.
          ⛔ Deliberately NOT a `<button>`. There is no action behind it, and a
          control that does nothing when pressed is worse than a graphic. */}
      <div
        className={`absolute ${CANVAS_CORNER_OFFSET_CLASSES[12]} ${CANVAS_GLYPH_SIZE_CLASSES[24]} rounded-full outline-none
          focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
        style={{ zIndex: 2 }}
        role="img"
        tabIndex={0}
        title={tooltip}
        aria-label={tooltip}
        data-testid="evidence-gap-badge-hover"
      />
    </>
  )
})
