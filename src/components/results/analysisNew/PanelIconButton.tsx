/**
 * ONE ICON-ONLY CONTROL FOR THE REASONING PANEL (Design System v5 §9.9):
 * tooltip mandatory, the label is also the accessible name, and the hit area
 * is 44px on touch while the glyph stays at row scale.
 *
 * `ai` swaps the glyph for the Olumi AI interaction icon (§9.8) and tints it
 * `text-info`, so every "ask / challenge / add context" act on the panel looks
 * the same and nothing else does. A caller never picks the AI glyph by hand.
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
        className={`relative inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-md [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11 ${
          ai ? 'text-info' : 'text-text-light'
        } hover:bg-panel-hover disabled:opacity-40 disabled:cursor-default ${
          pressed ? 'bg-panel-hover text-text-header' : ''
        } ${ACTION_FOCUS}`}
      >
        {Glyph ? <Glyph className={icon('section')} aria-hidden={true} /> : null}
        {marked ? (
          <span
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-info"
            aria-hidden={true}
            data-testid={testId ? `${testId}-mark` : undefined}
          />
        ) : null}
      </button>
    </Tooltip>
  )
}
