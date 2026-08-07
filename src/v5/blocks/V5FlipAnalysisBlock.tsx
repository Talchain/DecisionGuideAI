/**
 * V5FlipAnalysisBlock — renders V5 flip_analysis block (scenarios where
 * a single factor change flips the leading option).
 *
 * Each scenario is delivered with a bare `factor_id` and no label; the id is
 * resolved against the canvas store and the LABEL is rendered as the row's
 * left-hand text — never the id.
 *
 * UNRESOLVABLE FACTORS KEEP THEIR ROW, under an explicit "Unnamed factor".
 * This differs deliberately from V5ExplanationBlock, which omits chips it
 * cannot name. The distinction is whether the element carries data: a
 * referenced-option chip is a pure cross-link and loses nothing when
 * dropped, whereas a flip row carries the current value and the flip
 * threshold. Dropping it would silently destroy a measured result and would
 * also contradict the narrative above, which counts the scenarios ("Two
 * factors could flip the result"). Naming the gap honestly keeps the
 * numbers and tells the reader exactly what we could not resolve.
 */
import { useMemo, type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5FlipAnalysisBlock as V5FlipAnalysisBlockType } from '../../canvas/conversation/types'
import { useCanvasNodeLabels, resolveCanvasLabel } from './useCanvasLabels'

export interface V5FlipAnalysisBlockProps {
  block: V5FlipAnalysisBlockType
}

/** Shown when a factor id resolves to no canvas label. Never an identifier. */
const UNNAMED_FACTOR_LABEL = 'Unnamed factor'

function formatValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return v.toFixed(2)
}

export function V5FlipAnalysisBlock({ block }: V5FlipAnalysisBlockProps): ReactElement {
  const nodeLabels = useCanvasNodeLabels()

  const scenarios = useMemo(
    () =>
      block.flip_scenarios.map((s) => ({
        scenario: s,
        label: resolveCanvasLabel(s.factor_id, nodeLabels) ?? UNNAMED_FACTOR_LABEL,
      })),
    [block.flip_scenarios, nodeLabels],
  )

  return (
    <div
      data-testid="v5-flip-analysis"
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Flip analysis</h3>
      <p className={typography.panelBody}>{block.narrative}</p>
      {block.flip_scenarios.length > 0 && (
        <ul className={`${typography.panelMeta} space-y-1`} role="list">
          {scenarios.map(({ scenario: s, label }, i) => (
            <li
              // The id remains the React key and the test id — a machine
              // reference, which is exactly the use CEE's field-coverage
              // allowlist permits. Only the TEXT changes.
              key={`${s.factor_id}-${i}`}
              data-testid={`v5-flip-scenario-${s.factor_id}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-text-light">{label}:</span>
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
