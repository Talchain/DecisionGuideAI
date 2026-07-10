/**
 * V5ReviewCardBlock — renders a 0.13.x-typed CEE review_card block
 * (Track C slice 1, approved D-5; provisional_doctrine_v0).
 *
 * Truth-rendering contract:
 *   - Every visible string is the producer's, verbatim: title, body,
 *     target_refs[].label, action_label. The UI adds NO labels, NO
 *     science interpretation, NO severity copy.
 *   - `severity` drives the visual channel only (border/icon colour per
 *     the DS three-channel rule): info → info, warning → warning,
 *     critical → danger.
 *   - `card_kind` / `freshness` / `block_id` ride as data-* attributes for
 *     tests + diagnostics; they are never rendered as copy.
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch is a recorded follow-up
 *     (next round), not invented here.
 */
import { type ReactElement } from 'react'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import type { V5ReviewCardBlock as V5ReviewCardBlockType } from '../../canvas/conversation/types'

export interface V5ReviewCardBlockProps {
  block: V5ReviewCardBlockType
}

const SEVERITY_BORDER: Record<V5ReviewCardBlockType['severity'], string> = {
  info: 'border-info/30',
  warning: 'border-warning/30',
  critical: 'border-danger/30',
}

const SEVERITY_ICON_COLOUR: Record<V5ReviewCardBlockType['severity'], string> = {
  info: 'text-info',
  warning: 'text-warning',
  critical: 'text-danger',
}

export function V5ReviewCardBlock({ block }: V5ReviewCardBlockProps): ReactElement {
  const Icon = block.severity === 'info' ? Lightbulb : AlertTriangle
  return (
    <div
      data-testid="v5-review-card"
      data-block-id={block.block_id}
      data-card-kind={block.card_kind}
      data-severity={block.severity}
      data-freshness={block.freshness}
      className={`rounded-xl border ${SEVERITY_BORDER[block.severity]} bg-panel p-4 space-y-2`}
    >
      <div className="flex items-start gap-2">
        <Icon
          size={16}
          className={`flex-none mt-0.5 ${SEVERITY_ICON_COLOUR[block.severity]}`}
          aria-hidden="true"
        />
        <h3 className={typography.panelHeader} data-testid="v5-review-card-title">
          {block.title}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid="v5-review-card-body">
        {block.body}
      </p>
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="v5-review-card-refs"
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
            data-testid="v5-review-card-action"
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

export default V5ReviewCardBlock
