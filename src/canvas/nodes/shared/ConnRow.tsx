/**
 * ConnRow — compact connection row rendered inside canvas node cards.
 * Shows: [NodeShapeIndicator 9px] [node name link] ["N% conf." right-aligned]
 * Click opens the edge inspector for that specific edge.
 *
 * Audit §8 P0-4 (strength vs confidence): the percentage here is
 * beliefExists/exists_probability — CONFIDENCE the link exists — while
 * EdgePills' percentage is link STRENGTH. Both used the same bare "%"
 * format, silently switching meaning between pre- and post-analysis. The
 * visible "conf." qualifier (+ title/aria) makes this number
 * self-identifying next to the strength pills.
 *
 * ⭐ AN UNKNOWN IS DISCLOSED, NOT OMITTED
 * --------------------------------------
 * `confidencePct` is `null` only when `useNodeConnections`' provenance gate
 * found nothing that PROVES a confidence was stated (`isEdgeValueSet`). This
 * row used to render the cell not at all in that case, so the state read as a
 * bare name — visually identical to a row whose figure simply had not loaded,
 * and indistinguishable at a glance from a low number.
 *
 * WHO IS ACTUALLY IN IT, derived rather than assumed: a CEE-drafted edge
 * carries the raw wire `exists_probability`, which `edgeValueSource:154` honours
 * as back-compat evidence, so it renders a figure. `USER_EDGE_DEFAULTS`
 * (`domain/edges.ts:534`) sets `beliefExists: 0.8` with NO source stamp and no
 * raw key, exactly as its own comment demands. So the silent row was
 * **the connection the user drew by hand**, sitting beside drafted ones that all
 * showed "80% conf." — the user's own link looked like the empty one.
 *
 * ⛔ IT DISCLOSES; IT DOES NOT INVITE — and that asymmetry with the
 * pre-analysis lane is deliberate, not an oversight. `PreAnalysisInboundRows`
 * says "Link strength not set — open this connection to estimate it", and it is
 * entitled to: link strength became genuinely settable when the presets went
 * live (#1473). The quantity HERE is existence confidence, whose inspector
 * control is still fenced because it has no wire carrier. Copying that wording
 * across would advertise an action the product cannot perform — the precise
 * defect #1473 removed. So this states the gap and stops.
 *
 * ⚠⚠ THE RESIDUAL THIS CHOICE LEAVES, RECORDED RATHER THAN DISCOVERED LATER.
 * Two estate rulings meet here and they pull opposite ways, so the next reader
 * should not have to re-derive that tension or conclude one was overlooked:
 *
 *   · Paul, 31 Aug, quoted in `cardCopyCensus.canvas.spec.tsx`: byte-identical
 *     card copy "is a waste of space… should be a hover-over". That is why the
 *     words became a glyph.
 *   · `NodeMetricRow`'s header, two sentences later in that SAME census file:
 *     "THE CAPTION IS VISIBLE TEXT, NEVER A `title`" — for UI-SEM-089, and
 *     because a `title` is unreachable by keyboard on a non-focusable row and
 *     ABSENT ON TOUCH.
 *
 * So for a touch reader this cell's meaning now lives entirely in a carrier
 * they cannot reach: a bare name has become a bare glyph — visible, and still
 * undecodable. Raised in review of #1495 and deliberately NOT made a change
 * request there, because it is a conflict between two rulings rather than a
 * defect in the change, and it is strictly better than the silence it replaced.
 *
 * ⛔ WHAT WOULD SETTLE IT IS A DENSITY DECISION, NOT A CODE ONE — whether a
 * confidence cell may spend visible characters on "not set" in the narrowest
 * column on screen. That is Paul's call and it is open. Do not resolve it by
 * quietly adding the words back (the census REDs, correctly) or by deleting
 * this note. The `aria-label` already serves screen readers; the unserved
 * reader is specifically the sighted touch user.
 *
 * ⛔ AND IT MUST NOT BORROW THE STRENGTH WORDING FOR A SECOND REASON: these are
 * two number families (P0-4 above). "Link strength not set" on a confidence cell
 * would re-conflate them in the one state where no figure is present to
 * disambiguate. The P0-4 assertions still hold over this branch unchanged — no
 * "%" and no "conf." text renders — which is what proves this fills the silence
 * rather than reopening the conflation.
 */
import { useCallback } from 'react'
import { NodeShapeIndicator } from '../NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import type { NodeType } from '../../domain/nodes'
import { openEdgeStrengthEditor } from '../../utils/openEdgeStrengthEditor'

interface ConnRowProps {
  edgeId: string
  nodeKind: NodeType
  label: string
  /** Confidence percentage (0-100), or null when unknown */
  confidencePct: number | null
}

export function ConnRow({ edgeId, nodeKind, label, confidencePct }: ConnRowProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openEdgeStrengthEditor(edgeId)
  }, [edgeId])

  const truncated = label.length > 30 ? `${label.slice(0, 30)}...` : label

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-1 py-0.5 cursor-pointer nodrag nopan hover:bg-panel-hover rounded transition-colors"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as any) }}
    >
      <NodeShapeIndicator nodeKind={nodeKind} size={9} className="flex-shrink-0" />
      <span className={`${typography.edgeLabel} text-info underline flex-1 truncate`} title={label}>
        {truncated}
      </span>
      {confidencePct != null ? (
        <span
          className={`${typography.edgeLabel} text-text-light text-right shrink-0 whitespace-nowrap`}
          title="Confidence the link exists"
          aria-label={`${confidencePct}% confidence the link exists`}
        >
          {confidencePct}% conf.
        </span>
      ) : (
        <span
          className="shrink-0 inline-flex items-center"
          role="img"
          title="Nobody has stated how confident they are that this link exists"
          aria-label="Confidence the link exists is not set"
          data-testid={`conn-row-confidence-unset-${edgeId}`}
        >
          {/* ⛔ A GLYPH, NOT WORDS — and the census is why, not taste. The first
              cut of this rendered the string "Not set", which put IDENTICAL copy
              on every sibling card and RED `cardCopyCensus.canvas.spec.tsx`:
              Paul's 31 Aug ruling is that byte-identical card copy "is a waste of
              space… should be a hover-over". A mark costs one glyph of the
              narrowest column on the screen; the sentence lives in `title` and
              `aria-label`, where a census that reads `textContent` cannot be
              fooled into thinking the row says nothing. */}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" className="text-text-light" opacity="0.55" />
          </svg>
        </span>
      )}
    </div>
  )
}

/**
 * Plain-text overflow line for capped in-card lists (audit §8 P0-5 —
 * Detailed-view card containment). Rendered after exactly `shown` whole rows;
 * never a max-height clip. Returns null when nothing was truncated.
 */
export function ConnRowsOverflow({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null
  return (
    <p className={`${typography.edgeLabel} text-text-light m-0 mt-0.5`}>
      +{total - shown} more in inspector
    </p>
  )
}
