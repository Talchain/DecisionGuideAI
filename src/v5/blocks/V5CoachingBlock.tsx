/**
 * V5CoachingBlock — renders a 0.13.x-typed CEE coaching block
 * (Track C slice 1, approved D-5; provisional_doctrine_v0).
 *
 * Truth-rendering contract (same as V5ReviewCardBlock):
 *   - Every visible string is the producer's, verbatim: title, body,
 *     target_refs[].label, action_label. The UI adds NO labels and NO
 *     interpretation.
 *   - Coaching is facilitator-voice content → info visual channel,
 *     matching the existing coaching-card idiom (DS: bg-panel, never
 *     bg-*-light on cards).
 *   - `coaching_kind` / `source` / `freshness` / `block_id` ride as data-*
 *     attributes only — never rendered as copy. (`freshness` is optional:
 *     the UI-side bias bridge builds blocks without it — the attribute is
 *     simply absent then.)
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch is a recorded follow-up.
 *   - target_refs pills are click-to-focus (seamlessness R1): clickable only
 *     while the target exists on the canvas (fail-closed in TargetRefPill),
 *     label copy verbatim either way.
 *
 * Variants (review-folds C10+R1 — the separate BiasSignalCoachingCard
 * duplicated this whole structure and silently DROPPED action_label):
 *   - 'default': full border-info/30 card (the existing idiom).
 *   - 'bias_signal': the DS coaching-card recipe (DESIGN_SYSTEM.md
 *     "Coaching Cards (v4 §15)") — neutral bg-panel + coloured LEFT border
 *     (border-l-[3px] border-info), testid prefix `bias-signal-card` (the
 *     #356 specs key on it). ONLY the container class and testid prefix
 *     differ; structure, refs and the action_label pill are identical.
 */
import { type ReactElement } from 'react'
import { Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../canvas/conversation/types'

export interface V5CoachingBlockProps {
  block: V5CoachingBlockType
  variant?: 'default' | 'bias_signal'
}

const CONTAINER_CLASS: Record<'default' | 'bias_signal', string> = {
  default: 'rounded-xl border border-info/30 bg-panel p-4 space-y-2',
  bias_signal: 'bg-panel border-l-[3px] border-info rounded-lg px-4 py-3 space-y-2',
}

export function V5CoachingBlock({ block, variant = 'default' }: V5CoachingBlockProps): ReactElement {
  const testIdPrefix = variant === 'bias_signal' ? 'bias-signal-card' : 'v5-coaching'
  return (
    <div
      data-testid={testIdPrefix}
      data-block-id={block.block_id}
      data-coaching-kind={block.coaching_kind}
      data-coaching-source={block.source}
      data-freshness={block.freshness}
      className={CONTAINER_CLASS[variant]}
    >
      <div className="flex items-start gap-2">
        <Lightbulb size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        <h3 className={typography.panelHeader} data-testid={`${testIdPrefix}-title`}>
          {block.title}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid={`${testIdPrefix}-body`}>
        {block.body}
      </p>
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid={`${testIdPrefix}-refs`}
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
            data-testid={`${testIdPrefix}-action`}
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
