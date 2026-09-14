/**
 * V5EvidenceBlock — renders a 0.13.1-typed CEE evidence block
 * (Track C slice 2, Lane UI-W4 C; provisional_doctrine_v0).
 *
 * Truth-rendering contract (same as V5ReviewCardBlock / V5CoachingBlock):
 *   - Every visible string is the producer's, verbatim: the factor name
 *     (title), evidence_gap / suggested_technique / impact_if_gathered
 *     paragraphs, target_refs[].label, action_label. The UI adds NO
 *     labels and NO interpretation — the three prose fields render as
 *     bare paragraphs (adding field headings would be UI-authored copy;
 *     recorded follow-up if the producer later ships display labels).
 *   - Title per contract §1.3: renderers prefer the PRIMARY factor entry
 *     in target_refs (first entry with kind 'factor') over the
 *     backward-compatibility `factor_label` on conflict.
 *   - `severity` drives the visual channel only (border/icon colour per
 *     the DS three-channel rule) — identical mapping to V5ReviewCardBlock.
 *   - `current_confidence` / `freshness` / `block_id` ride as data-*
 *     attributes only — never rendered as copy — EXCEPT that the freshness/
 *     currency verdict now resolves to a plain-English notice (#670's
 *     mechanism, extended to this card; the #670 witness recorded evidence
 *     blocks carrying the superseded hash with no sentence, `WITNESS.md`
 *     §F1). Producer's verdict wins; the render-time derivation fills its
 *     silence. `cannot_confirm` rides as `data-currency` only (no depth
 *     layer on this card; #670 keeps cannot-confirm off the face).
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch remains the recorded
 *     follow-up from slice 1.
 */
import { type ReactElement } from 'react'
import { evidenceSeverityVisual } from './severityChannel'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import { resolveFreshnessNotice } from './coachingCurrency'
import { useCoachingCurrency } from './useCoachingCurrency'
import type { V5EvidenceBlock as V5EvidenceBlockType } from '../../canvas/conversation/types'

export interface V5EvidenceBlockProps {
  block: V5EvidenceBlockType
  /** See `V5CoachingBlockProps.suppressHeader` — same rule, same single caller. */
  suppressHeader?: boolean
}

// ⚠ THIS BLOCK HELD ITS OWN COPIES OF THE SEVERITY→COLOUR MAPS, byte-identical
// to the review card's, until `./severityChannel` became the single authority.
// It was the THIRD hand-maintained mirror of one mapping, and the review-card
// pair had already drifted once (a collapsed review card drew the same
// `text-info` for every severity, flattening a warning into routine).
//
// ⛔ AND THE GLYPH RULE MOVED WITH THEM, rather than staying a ternary here.
// `reviewSeverityVisual` hands back `Lightbulb` for `info` where this family
// draws `Search`, so the two families need separate descriptors — but a rule
// living inside ONE component is the altitude that produced #1450 in the first
// place, and `v5_evidence` is already a point candidate. See
// `evidenceSeverityVisual`.

/**
 * The evidence block's title, per contract §1.3.
 *
 * ⚠ EXPORTED BECAUSE THE COLLAPSED LINE NEEDS THE SAME ANSWER. `factor_label`
 * is a BACKWARD-COMPATIBILITY convenience; the canonical title is the primary
 * `target_refs` factor entry, and the two differ on conflict. A line that
 * titled itself from `factor_label` while this card titled itself from the
 * ref would put two different names on one block — the defect class this
 * estate keeps paying for. One function, both surfaces.
 */
export function evidenceBlockTitle(block: V5EvidenceBlockType): string {
  const primaryFactor = block.target_refs.find((ref) => ref.kind === 'factor')
  return primaryFactor?.label ?? block.factor_label
}

export function V5EvidenceBlock({ block, suppressHeader = false }: V5EvidenceBlockProps): ReactElement {
  const { Icon, tintClass, borderClass } = evidenceSeverityVisual(block.severity)
  const title = evidenceBlockTitle(block)
  /*
    THE UNCERTAINTY CHANNEL — #670's mechanism, consumed through the shared
    seam (`useCoachingCurrency` → `deriveCoachingCurrency`). Render-time, so
    the card starts telling the truth the moment the model moves.
  */
  const currency = useCoachingCurrency(block.graph_hash_at_generation)
  const freshnessNotice = resolveFreshnessNotice(block.freshness, currency)
  return (
    <div
      data-testid="v5-evidence"
      data-block-id={block.block_id}
      data-current-confidence={block.current_confidence}
      data-severity={block.severity}
      data-freshness={block.freshness}
      data-currency={currency}
      className={`rounded-md border ${borderClass} bg-panel p-4 space-y-2`}
    >
      {!suppressHeader && (
        <div className="flex items-start gap-2">
          <Icon
            size={16}
            className={`flex-none mt-0.5 ${tintClass}`}
            aria-hidden="true"
          />
          <h3 className={typography.panelHeader} data-testid="v5-evidence-title">
            {title}
          </h3>
        </div>
      )}
      <p className={typography.panelBody} data-testid="v5-evidence-gap">
        {block.evidence_gap}
      </p>
      <p className={typography.panelBody} data-testid="v5-evidence-technique">
        {block.suggested_technique}
      </p>
      <p className={typography.panelBody} data-testid="v5-evidence-impact">
        {block.impact_if_gathered}
      </p>
      {freshnessNotice && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-evidence-freshness"
        >
          {freshnessNotice}
        </p>
      )}
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="v5-evidence-refs"
        >
          {block.target_refs.map((ref) => (
            <TargetRefPill
              key={ref.id}
              role="listitem"
              id={ref.id}
              label={ref.label}
              kind={ref.kind}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-panel-border text-text-body',
                typography.panelMeta,
              ].join(' ')}
            />
          ))}
        </div>
      )}
      {block.action_label && (
        <div className="flex">
          <span
            data-testid="v5-evidence-action"
            {...(block.action_intent ? { 'data-action-intent': block.action_intent } : {})}
            className={[
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'bg-transparent border border-info/30 text-text-body',
              typography.panelMeta,
            ].join(' ')}
          >
            {block.action_label}
          </span>
        </div>
      )}
    </div>
  )
}

export default V5EvidenceBlock
