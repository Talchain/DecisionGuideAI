/**
 * V5ComparisonBlock — renders V5 comparison block (the options compared, and CEE's narrative).
 *
 * #2747 re-scope 2 (DL ruling (A)): no win share is said in C. The block's share column ("supported by N% of runs") is
 * gone with its withheld-share note: CEE serves no wording or Run authority for the share, so the card names the options
 * compared and says CEE's narrative verbatim. Restore trigger: a CEE-served share string with its own Run licence.
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5ComparisonBlock as V5ComparisonBlockType } from '../../canvas/conversation/types'

export interface V5ComparisonBlockProps {
  block: V5ComparisonBlockType
}

export function V5ComparisonBlock({ block }: V5ComparisonBlockProps): ReactElement {
  return (
    <div
      data-testid="v5-comparison"
      // DS v5 §21.2: a comparison (ScenarioBlock) is the option colour, as a
      // complete border (V7 L2).
      className="rounded-md border border-option/30 bg-panel p-4 space-y-2"
    >
      <h3 className={typography.panelHeader}>Comparison</h3>
      {block.narrative && (
        <p className={typography.chatBody}>{block.narrative}</p>
      )}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className={`${typography.chatMeta} text-text-light font-normal pb-1`}>Option</th>
          </tr>
        </thead>
        <tbody>
          {block.options.map((opt) => (
            <tr key={opt.option_id} data-testid={`v5-comparison-row-${opt.option_id}`}>
              <td className={`${typography.chatBody} pr-4 py-1`}>{opt.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default V5ComparisonBlock
