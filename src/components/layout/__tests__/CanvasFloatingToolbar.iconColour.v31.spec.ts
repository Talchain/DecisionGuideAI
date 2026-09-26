/**
 * contract v3.1 CHR-7 — the canvas toolbars' icons are MUTED AT REST
 * (`.canvas-tools button{color:#646761}`; DS v5 "Icon-only button |
 * text-text-light → text-text-body"), move to body colour on hover, and keep
 * info for the ACTIVE state only. The zoom read-out is the one text control and
 * reads as a value: body colour, weight 500.
 *
 * Served: `.iconButton` set no colour, so every glyph inherited the body's
 * `text-text-header` (#262626) — the darkest ink on the canvas.
 *
 * jsdom does not apply CSS modules, so this reads the stylesheet's own rule
 * blocks by exact selector (the grammar spec for this one shared file). A
 * positive control proves the reader finds a rule that is known to be there.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(__dirname, '..', 'CanvasFloatingToolbar.module.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Declarations of the rule whose selector list is EXACTLY `selector`. */
function rule(selector: string): Record<string, string> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(CSS)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const decl of m[1].split(';')) {
    const i = decl.indexOf(':')
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim()
  }
  return out
}

describe('canvas toolbar icon colour (contract v3.1 CHR-7)', () => {
  it('POSITIVE CONTROL: the reader finds a rule known to exist, with its values', () => {
    expect(rule('.iconButtonActive').color).toBe('var(--info)')
    expect(rule('.iconButton').width).toBe('29px')
  })

  it('⭐ muted at rest: every icon button is text-light, not the inherited header ink', () => {
    expect(rule('.iconButton').color).toBe('var(--text-light)')
  })

  it('⭐ body colour on hover — the DS icon-only-button step', () => {
    expect(rule('.iconButton:hover').color).toBe('var(--text-body)')
  })

  it('a present-but-inoperable control holds its resting colour on hover — hover must not suggest an action', () => {
    expect(rule(".iconButton[aria-disabled='true']:hover").color).toBe('var(--text-light)')
  })

  /**
   * v3.1 DESIGN-GAP #14 (26 Sep 2026): the standing zoom read-out left the
   * toolbar — v3.1 draws −, + and fit only — and its value is shown in the
   * overflow menu's "Zoom to 100%" item instead, as that item's muted meta
   * (`.menuItemMeta`), beside a body-coloured label.
   */
  it('⭐ the zoom level reads as the menu item’s meta: muted, tabular; the label is body ink', () => {
    expect(rule('.readout')).toEqual({})
    expect(rule('.menuItemMeta').color).toBe('var(--text-light)')
    expect(rule('.menuItemMeta')['font-variant-numeric']).toBe('tabular-nums')
    expect(rule('.menuItem').color).toBe('var(--text-body)')
  })

  it('⛔ CONTRAST: info stays reserved for the active state — no resting or hover rule uses it for the glyph', () => {
    expect(rule('.iconButton').color).not.toBe('var(--info)')
    expect(rule('.iconButton:hover').color).not.toBe('var(--info)')
  })
})
