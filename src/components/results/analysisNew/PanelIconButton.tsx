/**
 * ONE ICON-ONLY CONTROL FOR THE REASONING PANEL (Design System v5 §9.9):
 * tooltip mandatory, the label is also the accessible name, and the hit area
 * is 44px on touch while the glyph stays at row scale.
 *
 * `ai` swaps the glyph for the Olumi AI interaction icon (§9.8) and tints it
 * `text-info`, so every "ask / challenge / add context" act on the panel looks
 * the same and nothing else does. A caller never picks the AI glyph by hand.
 *
 * @panel-act-opt-out An icon-only control is not an `action()` tier: it has no
 * label to pad, so it carries the geometry itself: 28px square at rest
 * (min 24px in both dimensions, the guard's floor) and 44px on a touch pointer.
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
   * not grow a taller line around it. Still the 24px floor, and 44px on touch.
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
        /* ⭐ V2 fidelity gap 12: a CIRCLE, an outline on hover and an info ring
           when pressed. The old hover/pressed fill was bg-panel-hover, which
           measures 1.038:1 against bg-panel: a selected state nobody could see.
           No fill now, so pressed is a visible ring and colour, not a tint. */
        className={`relative inline-flex shrink-0 items-center justify-center ${
          inline
            ? 'w-6 h-6 -my-1 ml-0.5 align-middle rounded [@media(pointer:coarse)]:-my-3'
            : 'w-7 h-7 rounded-full'
        } min-w-[24px] min-h-[24px] [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11 ${
          pressed ? 'text-info ring-1 ring-inset ring-info' : ai ? 'text-info' : 'text-text-light'
        } hover:ring-1 hover:ring-inset hover:ring-border-emphasis disabled:opacity-40 disabled:cursor-default disabled:hover:ring-0 ${ACTION_FOCUS}`}
      >
        {Glyph ? <Glyph className={icon('section')} aria-hidden={true} /> : null}
        {marked ? (
          <span
            className="absolute top-1 right-1 size-1.5 rounded-full bg-info"
            aria-hidden={true}
            data-testid={testId ? `${testId}-mark` : undefined}
          />
        ) : null}
      </button>
    </Tooltip>
  )
}
