/**
 * BiasSignalCoachingCard — renders a `v5_coaching` block whose
 * coaching_kind is 'bias_signal' (leg 3 of the bias-coaching design,
 * BIAS-COACHING-PROPOSAL-2026-07-16 §2 FRAME beat; ratified cap ≤2 cards,
 * enforced upstream in buildDraftBiasSignalBlocks).
 *
 * Structure reuses the V5CoachingBlock idiom (header icon + title, body,
 * TargetRefPill refs, enum tokens as data-* only) but the styling follows
 * the DS coaching-card recipe (DESIGN_SYSTEM.md "Coaching Cards (v4 §15)"):
 * neutral bg-panel + coloured LEFT border (border-l-[3px] border-info),
 * NOT the full-border idiom — the DS audit found all three live
 * CoachingCard implementations (and V5CoachingBlock itself) contradict the
 * recipe, and this card must not propagate that.
 *
 * Copy contract:
 *   - title is the humanised bias name (allowlist-mapped upstream — a raw
 *     wire code like `status_quo_bias` can never reach this component);
 *   - body is the producer's detail verbatim;
 *   - the grounded reference renders as a click-to-focus TargetRefPill
 *     (fail-closed: inert when the node has left the canvas);
 *   - coaching_kind / source / freshness / block_id ride as data-* only;
 *   - info visual channel (coaching is facilitator-voice; never danger,
 *     no "bias detected" banner language — est. #23 card doctrine).
 */
import { type ReactElement } from 'react'
import { Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../canvas/conversation/types'

export interface BiasSignalCoachingCardProps {
  block: V5CoachingBlockType
}

export function BiasSignalCoachingCard({ block }: BiasSignalCoachingCardProps): ReactElement {
  return (
    <div
      data-testid="bias-signal-card"
      data-block-id={block.block_id}
      data-coaching-kind={block.coaching_kind}
      data-coaching-source={block.source}
      data-freshness={block.freshness}
      className="bg-panel border-l-[3px] border-info rounded-lg px-4 py-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <Lightbulb size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        <h3 className={typography.panelHeader} data-testid="bias-signal-card-title">
          {block.title}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid="bias-signal-card-body">
        {block.body}
      </p>
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="bias-signal-card-refs"
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
    </div>
  )
}

export default BiasSignalCoachingCard
