/**
 * V5ExerciseBlock — renders a 0.13.1-typed CEE exercise block
 * (Track C slice 2, Lane UI-W4 C; provisional_doctrine_v0).
 *
 * Truth-rendering contract (same family as the other typed Phase 3
 * renderers):
 *   - Every visible string is the producer's, verbatim. Per the v1.3
 *     contract the exercise block carries NO title — the card renders
 *     ONLY the optional producer prose fields that are present
 *     (failure_scenario, warning_signs list, mitigation, reference_class,
 *     counter_case, review_trigger, in schema order), as bare paragraphs
 *     with NO invented headings. The adapter guarantees at least one is
 *     present (content-less blocks fail closed upstream).
 *   - Exercises are reflective prompts (pre-mortem, outside view, …) →
 *     info visual channel (border-info/30 + ClipboardList), matching the
 *     legacy exercise idiom's info badge. No severity exists on this
 *     block type, so no severity channel is fabricated.
 *   - `exercise_kind` / `freshness` / `block_id` ride as data-*
 *     attributes only — never rendered as copy — EXCEPT that the freshness/
 *     currency verdict now resolves to a plain-English notice (#670's
 *     mechanism, extended to this card: exercise blocks carry
 *     `graph_hash_at_generation` on the live wire — T3 / no-critiques
 *     captures — and a pre-mortem about a model that no longer exists is as
 *     stale as any assumption card). Producer's verdict wins; the render-time
 *     derivation fills its silence. `cannot_confirm` rides as `data-currency`
 *     only (no depth layer on this card; #670 keeps cannot-confirm off the
 *     face).
 *   - `target_element_ref` (the element the exercise targets) and
 *     `target_refs` render together as reference pills, labels verbatim.
 */
import { type ReactElement } from 'react'
import { BookOpenCheck, ClipboardList } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import { resolveFreshnessNotice } from './coachingCurrency'
import { useCoachingCurrency } from './useCoachingCurrency'
import type {
  V5BlockTargetRef,
  V5ExerciseBlock as V5ExerciseBlockType,
} from '../../canvas/conversation/types'

export interface V5ExerciseBlockProps {
  block: V5ExerciseBlockType
}

export function V5ExerciseBlock({ block }: V5ExerciseBlockProps): ReactElement {
  // target_element_ref first (the exercise's subject), then the wider
  // refs; dedupe by id so a subject repeated in target_refs shows once.
  const refs: V5BlockTargetRef[] = []
  const seen = new Set<string>()
  for (const ref of [
    ...(block.target_element_ref ? [block.target_element_ref] : []),
    ...block.target_refs,
  ]) {
    if (seen.has(ref.id)) continue
    seen.add(ref.id)
    refs.push(ref)
  }

  /*
    THE UNCERTAINTY CHANNEL — #670's mechanism, consumed through the shared
    seam (`useCoachingCurrency` → `deriveCoachingCurrency`). Render-time, so
    the card starts telling the truth the moment the model moves.
  */
  const currency = useCoachingCurrency(block.graph_hash_at_generation)
  const freshnessNotice = resolveFreshnessNotice(block.freshness, currency)

  return (
    <div
      data-testid="v5-exercise"
      data-block-id={block.block_id}
      data-exercise-kind={block.exercise_kind}
      data-freshness={block.freshness}
      data-currency={currency}
      className="rounded-xl border border-info/30 bg-panel p-4 space-y-2"
    >
      {/*
        0.37.0 (ROADMAP 2.490 slice 2) — the decision-science attribution.
        Every visible string here is the CANONICAL BUNDLE's, carried verbatim
        from `data/dsk/v1.json` by CEE: the protocol's own `title` and its own
        `evidence_strength`. Nothing on this badge is authored in the UI except
        the two static labels ("Decision-science protocol", "evidence"), which
        make no claim about the science — they name the channel.

        ⚠ That constraint is the entire point, and it is CEE #830's lesson:
        that badge rendered `grounding.principle`, THE MODEL'S OWN PROSE, under
        a label asserting the bundle's authority, and a type comment calling it
        a "Sanitised DSK claim title" made the lie legible to nobody. So this
        component must never interpolate assistant text, never map an id to a
        friendly name of its own, and never render a partial triple — the
        adapter guarantees all three members or none.
      */}
      {block.dsk_provenance && (
        <div
          data-testid="v5-exercise-dsk-provenance"
          data-dsk-protocol-id={block.dsk_provenance.protocol_id}
          data-dsk-evidence-strength={block.dsk_provenance.evidence_strength}
          className={`${typography.panelMeta} flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted`}
        >
          <BookOpenCheck size={12} className="flex-none text-info" aria-hidden="true" />
          <span>Decision-science protocol:</span>
          <span className="text-text-body">{block.dsk_provenance.protocol_title}</span>
          <span aria-hidden="true">·</span>
          <span>{block.dsk_provenance.evidence_strength} evidence</span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <ClipboardList size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        <div className="space-y-2 min-w-0">
          {block.failure_scenario && (
            <p className={typography.panelBody} data-testid="v5-exercise-failure-scenario">
              {block.failure_scenario}
            </p>
          )}
          {block.warning_signs && block.warning_signs.length > 0 && (
            <ul
              className={`${typography.panelBody} list-disc pl-5 space-y-1`}
              data-testid="v5-exercise-warning-signs"
            >
              {block.warning_signs.map((sign, i) => (
                <li key={i}>{sign}</li>
              ))}
            </ul>
          )}
          {block.mitigation && (
            <p className={typography.panelBody} data-testid="v5-exercise-mitigation">
              {block.mitigation}
            </p>
          )}
          {block.reference_class && (
            <p className={typography.panelBody} data-testid="v5-exercise-reference-class">
              {block.reference_class}
            </p>
          )}
          {block.counter_case && (
            <p className={typography.panelBody} data-testid="v5-exercise-counter-case">
              {block.counter_case}
            </p>
          )}
          {block.review_trigger && (
            <p className={typography.panelBody} data-testid="v5-exercise-review-trigger">
              {block.review_trigger}
            </p>
          )}
        </div>
      </div>
      {freshnessNotice && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-exercise-freshness"
        >
          {freshnessNotice}
        </p>
      )}
      {refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="v5-exercise-refs"
        >
          {refs.map((ref) => (
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
    </div>
  )
}

export default V5ExerciseBlock
