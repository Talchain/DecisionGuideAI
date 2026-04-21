/**
 * V5FlipAnalysisBlock — renders V5 flip_analysis block (scenarios where
 * a single factor change flips the leading option).
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5FlipAnalysisBlock as V5FlipAnalysisBlockType } from '../../canvas/conversation/types'

export interface V5FlipAnalysisBlockProps {
  block: V5FlipAnalysisBlockType
}

function formatValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return v.toFixed(2)
}

export function V5FlipAnalysisBlock({ block }: V5FlipAnalysisBlockProps): ReactElement {
  return (
    <div
      data-testid="v5-flip-analysis"
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Flip analysis</h3>
      <p className={typography.panelBody}>{block.narrative}</p>
      {block.flip_scenarios.length > 0 && (
        <ul className={`${typography.panelMeta} space-y-1`} role="list">
          {block.flip_scenarios.map((s, i) => (
            <li
              key={`${s.factor_id}-${i}`}
              data-testid={`v5-flip-scenario-${s.factor_id}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-text-light">{s.factor_id}:</span>
              <span className="text-text-body">{formatValue(s.current_value)}</span>
              <span className="text-text-light">→</span>
              <span className="text-text-body font-medium">{formatValue(s.flip_threshold)}</span>
              {s.fragile && (
                <span
                  className={[
                    'inline-flex items-center rounded-full px-2.5 py-0.5',
                    'bg-transparent border border-warning/30 text-text-body',
                    typography.panelMeta,
                  ].join(' ')}
                >
                  Fragile
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default V5FlipAnalysisBlock
