/**
 * The Changes view's word on a card — "Changed", "Added to the comparison" or "Result moved".
 *
 * Design System v5 §8.5: one pill treatment, OUTLINED, dark text, the meaning carried by the border (on canvas:
 * `bg-panel`) — the canvas state-word geometry (`STATE_WORD_CLASSES`) with the Info border instead of the
 * warning one, because a change is information, not a problem. §3.12: never colour alone — the word says it.
 *
 * It sits just ABOVE the card's top-left edge: the top-right corner belongs to `node-corner-stack` and the top
 * centre to the kind marker, so the chip covers neither and never touches the card's own text.
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
  `${typography.edgeLabel} pointer-events-none absolute left-0 bottom-full mb-[calc(4px*var(--canvas-label-scale,1))] ` +
  'shrink-0 whitespace-nowrap inline-flex items-center font-normal text-text-body bg-panel border border-solid border-info/50 rounded-full'

export const RunChangeBadge = memo(function RunChangeBadge({ mark, nodeId }: { mark: RunChangeMark; nodeId: string }) {
  return (
    <span className={CLASSES} style={STATE_WORD_STYLE} data-testid={`run-change-badge-${nodeId}`} data-run-change={mark}>
      {RUN_CHANGE_WORDS[mark]}
    </span>
  )
})
