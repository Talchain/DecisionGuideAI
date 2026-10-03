/**
 * The Changes view's word on a card — "Changed", "Added to the comparison" or "Result moved".
 *
 * Design System v5 §8.5: one pill treatment, OUTLINED, dark text, the meaning carried by the border (on canvas:
 * `bg-panel`) — the canvas state-word geometry (`STATE_WORD_CLASSES`) with the Info border instead of the
 * warning one, because a change is information, not a problem. §3.12: never colour alone — the word says it.
 *
 * It sits just BELOW the card's bottom-RIGHT corner, outside the card. Measured on the served build (4f61c322, 1280):
 * ABOVE-left, the chip landed on the lane title ("ALTERNATIVES"), which `deriveLaneTitles` places above-left of
 * every lane's first row. Above-centre is the kind marker; inside top-right is `node-corner-stack`; inside the
 * footer band are the quick actions. Below-right touches none of them, and the next lane's title is on the left.
 */
import { memo } from 'react'
import { typography } from '../../styles/typography'
import { STATE_WORD_STYLE } from '../nodes/shared/StatusPill'
import type { RunChangeMark } from './graphChangesView'

export const RUN_CHANGE_WORDS: Record<RunChangeMark, string> = {
  changed: 'Changed',
  // An option that ENTERED the comparison — it may have been on the canvas before (graphChangesView header).
  added: 'Added to the comparison',
  // Its share of runs moved beyond run-to-run noise. A result, never a reason.
  moved: 'Result moved',
}

const CLASSES =
  `${typography.edgeLabel} pointer-events-none absolute right-0 top-full mt-[calc(4px*var(--canvas-label-scale,1))] ` +
  'shrink-0 whitespace-nowrap inline-flex items-center font-normal text-text-body bg-panel border border-solid border-info/50 rounded-full'

export const RunChangeBadge = memo(function RunChangeBadge({ mark, nodeId }: { mark: RunChangeMark; nodeId: string }) {
  return (
    <span className={CLASSES} style={STATE_WORD_STYLE} data-testid={`run-change-badge-${nodeId}`} data-run-change={mark}>
      {RUN_CHANGE_WORDS[mark]}
    </span>
  )
})
