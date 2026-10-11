/**
 * ⭐⭐ THE ROW-END REASONING PROMPT AS AN ICON-ONLY BUTTON (Paul, 30 Sep 2026
 * ~12:30Z: "improve the design of the right-hand panels, helping users think
 * about what they could do, what else could drive this, and what else could
 * follow. Those could be icons with hover states … save space with them, but
 * make them visible and easy to use").
 *
 * ## Built to Design System v5, rule by rule (Paul ~12:45Z: "Are you actually
 * following our design system?")
 * - §9.9 icon-only button, with the shared tooltip mandatory: `Tooltip asChild` from
 *   `src/components/Tooltip.tsx`, with the 300 ms node delay, keyboard-focus
 *   disclosure and Escape dismissal. The tooltip carries the row's QUESTION
 *   ("What else could you do?"), which is also the accessible name.
 * - §9.3 tier-2 action glyph `Plus`. The node-type icons of §9.4 are off-canvas
 *   only, so they are not used here.
 * - §9.2 / §7.3 neutral action colour: `text-text-light` at rest,
 *   `text-text-body` on hover. No invented hover treatment.
 * - §8.1 secondary button (outlined neutral, `hover:bg-panel-hover`), with §8.5's
 *   `bg-panel` on the canvas and §6.2's `pill` radius (`rounded-full`). The
 *   outline is `border-text-light` (4.65:1 on the canvas), NOT `border-panel-border`:
 *   that token is rgb 238 230 216, ~1.1:1 on the #F4F0EA canvas, and it made the
 *   first cut invisible, the same failure as the 24 Sep dot grid. §5 `shadow-1`
 *   (resting) lifts it off the ground.
 * - §6.3 focus ring: `ring-2 ring-offset-2 ring-info`, always visible.
 * - SIZE (Paul, 1 Oct 2026: "Make the plus buttons on the right smaller. They're
 *   overbearing at the moment. They should be 50% smaller."): 32 flow units square
 *   with a 12px glyph, half the 30 Sep ruling's 64 / 24. ⚠ Paul's ruling, below
 *   §9.9's 44×44 touch target. A transparent overlay now maintains a 24 CSS px
 *   hit target at every zoom without changing this painted size or layout slot.
 *
 * It costs no layout width: the 160-unit tile it replaces took 184 units of every
 * row's budget, and those go to the cards (`ROW_BUDGET_W`). Behaviour is
 * unchanged: `onOpen` pre-fills the ask (`openWhatElseFromDoor` → `requestAsk`)
 * and never sends, and the far rung hides the button without unmounting it.
 */
import type { KeyboardEvent, MouseEvent } from 'react'
import { Handle, Position, useViewport } from '@xyflow/react'
import { Plus } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { ROW_PROMPT_H, ROW_PROMPT_W } from '../../utils/nodeLayoutConstants'
import { CANVAS_GLYPH_SIZE_CLASSES, MIN_TARGET_RENDERED_PX } from './canvasGlyphScale'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

export interface RowEndPromptIconProps {
  /** The row's question, said in full: the accessible name and the tooltip. */
  label: string | undefined
  tier: string | undefined
  testId: string
  /** The far (`line`) rung hides the prompt but keeps its box (ED S4). */
  hidden: boolean
  onOpen: (e: { clientX?: number; clientY?: number; currentTarget: EventTarget | null }) => void
}

export function RowEndPromptIcon({ label, tier, testId, hidden, onOpen }: RowEndPromptIconProps) {
  const { zoom } = useViewport()
  // Flow units to grow on each side so the live-zoom target is at least MIN_TARGET_RENDERED_PX (0 once the slot already is).
  const hitGrow = Math.max(0, (MIN_TARGET_RENDERED_PX / zoom - Math.min(ROW_PROMPT_W, ROW_PROMPT_H)) / 2)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(e)
    }
  }
  return (
    <div
      className="relative nodrag nopan"
      style={{ width: ROW_PROMPT_W, height: ROW_PROMPT_H, visibility: hidden ? 'hidden' : undefined }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={hidden ? undefined : label}>
        <div
          role="button"
          tabIndex={hidden ? -1 : 0}
          aria-label={label}
          aria-hidden={hidden ? true : undefined}
          data-testid={testId}
          data-tier={tier}
          data-row-end-prompt="icon"
          onClick={(e: MouseEvent<HTMLDivElement>) => onOpen(e)}
          onKeyDown={onKeyDown}
          // The far rung hides the control ITSELF as well as its box (the prompts' far-rung contract).
          // `--row-end-hit-grow` sizes the transparent `::before` hit slop (index.css `.row-end-hit`): the painted
          // slot, glyph and measured node box are unchanged, and the slop reaches MIN_TARGET_RENDERED_PX at this zoom.
          style={{ ...(hidden ? { visibility: 'hidden' as const } : {}), ['--row-end-hit-grow' as string]: `${hitGrow}px` }}
          className={[
            'row-end-hit absolute inset-0 flex items-center justify-center rounded-full cursor-pointer',
            'bg-panel border border-text-light text-text-light shadow-1',
            'hover:bg-panel-hover hover:text-text-body transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info',
          ].join(' ')}
        >
          <Plus size={12} className={CANVAS_GLYPH_SIZE_CLASSES[12]} aria-hidden="true" />
        </div>
      </Tooltip>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
