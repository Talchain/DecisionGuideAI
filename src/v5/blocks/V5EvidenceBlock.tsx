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
 *     attributes only — never rendered as copy.
 *   - `action_label` renders as a display-only outlined pill this slice;
 *     wiring `action_intent` to turn dispatch remains the recorded
 *     follow-up from slice 1.
 */
import { type ReactElement } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { V5EvidenceBlock as V5EvidenceBlockType } from '../../canvas/conversation/types'

export interface V5EvidenceBlockProps {
  block: V5EvidenceBlockType
}

const SEVERITY_BORDER: Record<V5EvidenceBlockType['severity'], string> = {
  info: 'border-info/30',
  warning: 'border-warning/30',
  critical: 'border-danger/30',
}

const SEVERITY_ICON_COLOUR: Record<V5EvidenceBlockType['severity'], string> = {
  info: 'text-info',
  warning: 'text-warning',
  critical: 'text-danger',
}

export function V5EvidenceBlock({ block }: V5EvidenceBlockProps): ReactElement {
  const Icon = block.severity === 'info' ? Search : AlertTriangle
  // §1.3: the primary factor entry in target_refs is canonical; the
  // top-level factor_label is a backward-compatibility convenience.
  const primaryFactor = block.target_refs.find((ref) => ref.kind === 'factor')
  const title = primaryFactor?.label ?? block.factor_label
  return (
    <div
      data-testid="v5-evidence"
      data-block-id={block.block_id}
      data-current-confidence={block.current_confidence}
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
        <h3 className={typography.panelHeader} data-testid="v5-evidence-title">
          {title}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid="v5-evidence-gap">
        {block.evidence_gap}
      </p>
      <p className={typography.panelBody} data-testid="v5-evidence-technique">
        {block.suggested_technique}
      </p>
      <p className={typography.panelBody} data-testid="v5-evidence-impact">
        {block.impact_if_gathered}
      </p>
      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid="v5-evidence-refs"
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
