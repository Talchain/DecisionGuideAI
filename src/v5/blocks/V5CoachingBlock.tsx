/**
 * V5CoachingBlock — renders a 0.13.x-typed CEE coaching block
 * (Track C slice 1, approved D-5; provisional_doctrine_v0).
 *
 * Truth-rendering contract (same as V5ReviewCardBlock):
 *   - Every visible string is the producer's, verbatim: title, body,
 *     target_refs[].label, action_label. The UI adds NO labels and NO
 *     interpretation.
 *   - Coaching is facilitator-voice content → info visual channel
 *     (border-info/30 + Lightbulb), matching the existing coaching-card
 *     idiom (DS: bg-panel, never bg-*-light on cards).
 *   - `coaching_kind` / `source` / `freshness` / `block_id` ride as data-*
 *     attributes only — never rendered as copy.
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch is a recorded follow-up.
 */
import { type ReactElement } from 'react'
import { Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../canvas/conversation/types'

export interface V5CoachingBlockProps {
  block: V5CoachingBlockType
}

export function V5CoachingBlock({ block }: V5CoachingBlockProps): ReactElement {
  return (
    <div
      data-testid="v5-coaching"
      data-block-id={block.block_id}
      data-coaching-kind={block.coaching_kind}
      data-coaching-source={block.source}
      data-freshness={block.freshness}
      className="rounded-xl border border-info/30 bg-panel p-4 space-y-2"
    >
      <div className="flex items-start gap-2">
        <Lightbulb size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        <h3 className={typography.panelHeader} data-testid="v5-coaching-title">
          {block.title}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid="v5-coaching-body">
        {block.body}
      </p>
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="v5-coaching-refs"
        >
          {block.target_refs.map((ref) => (
            <span
              key={ref.id}
              role="listitem"
              data-ref-id={ref.id}
              data-ref-kind={ref.kind}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-panel-border text-text-body',
                typography.panelMeta,
              ].join(' ')}
            >
              {ref.label}
            </span>
          ))}
        </div>
      )}
      {block.action_label && (
        <div className="flex">
          <span
            data-testid="v5-coaching-action"
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

export default V5CoachingBlock
