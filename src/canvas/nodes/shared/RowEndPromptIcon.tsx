/**
 * ⭐⭐ THE ROW-END REASONING PROMPT AS AN ICON BUTTON (Paul, 30 Sep 2026 ~12:30Z:
 * "improve the design of the right-hand panels, helping users think about what
 * they could do, what else could drive this, and what else could follow. Those
 * could be icons with hover states … save space with them, but make them visible
 * and easy to use").
 *
 * At rest: a 48-unit circle at the row end, with a dashed outline, the row's own
 * glyph, and a small "+" badge saying it adds something. On hover or keyboard
 * focus, the outline goes solid in the accent and the row's QUESTION opens as a
 * pill beside it ("What else could you do?"). The pill overlays the free canvas
 * past the row end, so it costs no layout width; the width the old 160-unit
 * tile took goes to the cards (`ROW_BUDGET_W`).
 *
 * The question is ALSO the accessible name, so a screen reader and a keyboard
 * user get the whole ask without hovering. The behaviour is unchanged: the caller's
 * `onOpen` pre-fills the ask (`openWhatElseFromDoor` → `requestAsk`) and never
 * sends. The far-rung rule is unchanged too: hidden, not unmounted.
 */
import type { KeyboardEvent, MouseEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlertTriangle, CornerDownRight, GitMerge, Lightbulb, Plus, type LucideIcon } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { ROW_PROMPT_H, ROW_PROMPT_W } from '../../utils/nodeLayoutConstants'
import { CANVAS_GLYPH_SIZE_CLASSES } from './canvasGlyphScale'

/** The row's glyph: a new option is an idea; a driver feeds in; a consequence follows; a risk warns. */
const GLYPH_BY_TIER: Readonly<Record<string, LucideIcon>> = {
  option: Lightbulb,
  factor: GitMerge,
  action: GitMerge,
  constraint: GitMerge,
  outcome: CornerDownRight,
  consequence: CornerDownRight,
  risk: AlertTriangle,
}

export const ROW_END_PROMPT_PILL_TESTID = 'row-end-prompt-question'

export interface RowEndPromptIconProps {
  /** The row's question, said in full: the accessible name and the hover pill. */
  label: string | undefined
  tier: string | undefined
  testId: string
  /** The far (`line`) rung hides the prompt but keeps its box (ED S4). */
  hidden: boolean
  onOpen: (e: { clientX?: number; clientY?: number; currentTarget: EventTarget | null }) => void
}

export function RowEndPromptIcon({ label, tier, testId, hidden, onOpen }: RowEndPromptIconProps) {
  const Glyph = (tier !== undefined ? GLYPH_BY_TIER[tier] : undefined) ?? Plus
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(e)
    }
  }
  return (
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
      className="group relative cursor-pointer nodrag nopan outline-none"
      style={{ width: ROW_PROMPT_W, height: ROW_PROMPT_H, visibility: hidden ? 'hidden' : undefined }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <span
        aria-hidden="true"
        className={[
          'absolute inset-0 flex items-center justify-center rounded-full bg-panel text-text-light',
          'border-[1.5px] border-dashed border-text-light transition-colors',
          'group-hover:border-solid group-hover:border-info group-hover:text-info group-hover:bg-panel-hover',
          'group-focus-visible:border-solid group-focus-visible:border-info group-focus-visible:text-info',
          'group-focus-visible:ring-2 group-focus-visible:ring-info/40',
        ].join(' ')}
      >
        <Glyph size={20} className={CANVAS_GLYPH_SIZE_CLASSES[20]} />
        <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-panel border border-current">
          <Plus size={10} className={CANVAS_GLYPH_SIZE_CLASSES[10]} strokeWidth={3} />
        </span>
      </span>
      {label ? (
        <span
          aria-hidden="true"
          data-testid={ROW_END_PROMPT_PILL_TESTID}
          className={[
            typography.edgeLabel,
            'pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap',
            'rounded-full border border-info bg-panel px-3 py-1 text-text-primary shadow-sm',
            'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
          ].join(' ')}
        >
          {label}
        </span>
      ) : null}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}
