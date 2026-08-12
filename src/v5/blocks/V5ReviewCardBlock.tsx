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
 *     tests + diagnostics; they are never rendered as copy — EXCEPT that the
 *     freshness/currency verdict now resolves to a plain-English notice
 *     (#670's mechanism, extended to this card): the producer's verdict wins
 *     where it has spoken (stale/pending/failed), and the render-time
 *     CEE-hash-vs-CEE-hash derivation fills its silence. The #670 browser
 *     witness caught THIS card silent — two "load-bearing assumption" review
 *     cards directly above a coaching card that said it was out of date, all
 *     three carrying the same superseded hash (`WITNESS.md` §F1).
 *   - `cannot_confirm` rides as `data-currency` only: this card has no depth
 *     layer, and #670 deliberately keeps cannot-confirm OFF the face (the
 *     card makes no currency claim there, so there is nothing false to
 *     correct). Minting a disclosure here would be new design, not extension.
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch is a recorded follow-up
 *     (next round), not invented here.
 */
import { type ReactElement } from 'react'
import { AlertTriangle, Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import { resolveFreshnessNotice } from './coachingCurrency'
import { useCoachingCurrency } from './useCoachingCurrency'
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
  /*
    THE UNCERTAINTY CHANNEL — #670's mechanism, consumed through the shared
    seam (`useCoachingCurrency` → `deriveCoachingCurrency`; see those modules
    for the whole argument). Read at RENDER time so a card already on screen
    starts telling the truth the moment the model moves underneath it.
  */
  const currency = useCoachingCurrency(block.graph_hash_at_generation)
  const freshnessNotice = resolveFreshnessNotice(block.freshness, currency)
  return (
    <div
      data-testid="v5-review-card"
      data-block-id={block.block_id}
      data-card-kind={block.card_kind}
      data-severity={block.severity}
      data-freshness={block.freshness}
      data-currency={currency}
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
      {freshnessNotice && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-review-card-freshness"
        >
          {freshnessNotice}
        </p>
      )}
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
