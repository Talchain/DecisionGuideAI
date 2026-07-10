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
 *     attributes only — never rendered as copy.
 *   - `target_element_ref` (the element the exercise targets) and
 *     `target_refs` render together as reference pills, labels verbatim.
 */
import { type ReactElement } from 'react'
import { ClipboardList } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
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

  return (
    <div
      data-testid="v5-exercise"
      data-block-id={block.block_id}
      data-exercise-kind={block.exercise_kind}
      data-freshness={block.freshness}
      className="rounded-xl border border-info/30 bg-panel p-4 space-y-2"
    >
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
