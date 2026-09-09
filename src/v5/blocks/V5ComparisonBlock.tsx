/**
 * V5ComparisonBlock — renders V5 comparison block (table of options).
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5ComparisonBlock as V5ComparisonBlockType } from '../../canvas/conversation/types'
import { METRIC_NOUN } from '../../canvas/nodes/shared/metricVocabulary'

export interface V5ComparisonBlockProps {
  block: V5ComparisonBlockType
}

function formatProb(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) return '—'
  return `${Math.round(p * 100)}%`
}

export function V5ComparisonBlock({ block }: V5ComparisonBlockProps): ReactElement {
  return (
    <div
      data-testid="v5-comparison"
      className="rounded-md border border-panel-border bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Comparison</h3>
      {block.narrative && (
        <p className={typography.panelBody}>{block.narrative}</p>
      )}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className={`${typography.panelMeta} text-text-light font-normal pb-1`}>Option</th>
            {/* ⛔ A VISIBLE COLUMN HEADER, and the second survivor both sweeps
                missed. By reference: this table captions the same quantity the
                option card does, so it takes the same word from the same
                register. */}
            <th className={`${typography.panelMeta} text-text-light font-normal pb-1`}>{METRIC_NOUN.support}</th>
          </tr>
        </thead>
        <tbody>
          {block.options.map((opt) => (
            <tr key={opt.option_id} data-testid={`v5-comparison-row-${opt.option_id}`}>
              <td className={`${typography.panelBody} pr-4 py-1`}>{opt.label}</td>
              <td className={`${typography.panelBody} py-1`}>{formatProb(opt.win_probability)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default V5ComparisonBlock
