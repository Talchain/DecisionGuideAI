/**
 * ONE ICON-ONLY CONTROL FOR THE REASONING PANEL (Design System v5 §9.9):
 * tooltip mandatory, the label is also the accessible name, and the glyph
 * stays at row scale. Paul 14 Oct 2026: PoC is desktop-only; touch sizing not required.
 *
 * `ai` swaps the glyph for the Olumi AI interaction icon (§9.8) and tints it
 * `text-info`, so every "ask / challenge / add context" act on the panel looks
 * the same and nothing else does. A caller never picks the AI glyph by hand.
 *
 * @panel-act-opt-out An icon-only control is not an `action()` tier: it has no
 * label to pad, so it carries the geometry itself: 24px square at rest (the
 * guard's floor, WCAG 2.2 §2.5.8, in both dimensions). No coarse-pointer
 * enlargement: Paul 14 Oct 2026: PoC is desktop-only; touch sizing not required.
 *
 * ⭐ COMPACT (Paul, 14 Oct 2026: "the edit and Olumi icons on the right are too
 * big, taking up too much space"). Was a 28px box around a 16px `icon('section')`
 * glyph, which pushed every 19.5px row to 28px. Now the box is the 24px floor and
 * the glyph is a ROW glyph: Lucide at `icon('row')`, and the Olumi mark one step
 * down at `icon('inline')` because the mark fills ~96% of its viewBox where a
 * Lucide glyph fills ~80%, so the two read at the same optical size side by side.
 *
 * ⚠ It renders a control only. What the click does — `requestAsk`,
 * `focusModelTarget`, `openModelValueEditor` — stays the caller's, so this
 * primitive cannot become a second ask route.
 */
import type { ComponentType } from 'react'
import Tooltip from '../../Tooltip'
import { OlumiAiIcon } from './OlumiAiIcon'
import { ACTION_FOCUS, icon } from './panelSurfaces'

type GlyphProps = { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }

export interface PanelIconButtonProps {
  /** The tooltip AND the accessible name. Say what happens, not what it is. */
  label: string
  onClick: () => void
  /** A Lucide icon. Ignored when `ai` is set. */
  Icon?: ComponentType<GlyphProps>
  /** An AI interaction: renders the Olumi AI icon. */
  ai?: boolean
  disabled?: boolean
  pressed?: boolean
  expanded?: boolean
  hasPopup?: 'menu'
  /** A small dot on the glyph, e.g. "this run raised this method". */
  marked?: boolean
  /**
   * Sits INSIDE a line of text (the prototype's `.ai-inline`, after "Still
   * open"): a 24px rounded square on the text's middle whose negative block
   * margin keeps the line box at the text's own height, so the sentence does
   * not grow a taller line around it. Still the 24px floor.
   */
  inline?: boolean
  testId?: string
}

export function PanelIconButton({
  label,
  onClick,
  Icon,
  ai = false,
  disabled = false,
  pressed,
  expanded,
  hasPopup,
  marked = false,
  inline = false,
  testId,
}: PanelIconButtonProps) {
  const Glyph = ai ? OlumiAiIcon : Icon
  return (
    <Tooltip asChild content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-haspopup={hasPopup}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        data-ai={ai ? 'true' : undefined}
        /* ⭐ V2 fidelity gap 12 + P50: a CIRCLE, an outline on hover, and when pressed an info glyph inside a
           NEUTRAL ring. Not the bg-panel-hover tint (1.038:1, invisible) and not a blue ring (Paul audit #2). */
        className={`relative inline-flex shrink-0 items-center justify-center ${
          inline
            ? 'w-6 h-6 -my-1 ml-0.5 align-middle rounded'
            : 'w-6 h-6 rounded-full'
        } min-w-[24px] min-h-[24px] ${
          pressed ? 'text-info ring-1 ring-inset ring-gray-400' : ai ? 'text-info' : 'text-text-light'
        } hover:ring-1 hover:ring-inset hover:ring-border-emphasis disabled:opacity-40 disabled:cursor-default disabled:hover:ring-0 ${ACTION_FOCUS}`}
      >
        {Glyph ? <Glyph className={icon(ai ? 'inline' : 'row')} aria-hidden={true} /> : null}
        {marked ? (
          <span
            className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-info"
            aria-hidden={true}
            data-testid={testId ? `${testId}-mark` : undefined}
          />
        ) : null}
      </button>
    </Tooltip>
  )
}
