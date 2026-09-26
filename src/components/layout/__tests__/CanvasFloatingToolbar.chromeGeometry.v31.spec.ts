/**
 * contract v3.1 — the canvas toolbars' RADIUS and the viewport controls' BOTTOM
 * OFFSET (DESIGN-GAP-AUDIT rows 32 and 25, chrome cluster, 25 Sep 2026).
 *
 * Contract `<style>`:
 *   `.canvas-tools{…border-radius:12px…}` — both toolbars (`.zoom-tools` is a
 *     `.canvas-tools` too, so the one value covers the pair);
 *   `.zoom-tools{top:auto;bottom:40px}`.
 * Served before this change: radius 16 on the shared surface, and the viewport
 * controls anchored 12px off the bottom.
 *
 * ⭐ BUTTON SIZE MOVED LATER, IN ITS OWN ROW (v3.1 DESIGN-GAP #13, 26 Sep 2026).
 * This file first pinned the 32px bordered circles as a CONTRAST so rows 32/25
 * could not drag them along. #13 then took the contract's `.canvas-tools
 * button` (29×31, radius 6, no border) deliberately; the stylesheet records why
 * dropping the `--border-field` outline is not a WCAG 1.4.11 regression.
 *
 * jsdom does not apply CSS modules, so — as in the sibling
 * `CanvasFloatingToolbar.iconColour.v31.spec.ts` — this reads the stylesheet's
 * own rule blocks by EXACT selector, with a positive control proving the reader
 * finds rules known to exist.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OVERLAY_BAND_LEFT_PAD } from '../../../canvas/components/CanvasOverlayBand'

const ROOT = join(__dirname, '..', '..', '..', '..')
const CSS = readFileSync(join(__dirname, '..', 'CanvasFloatingToolbar.module.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const DEBUG_PANEL_SRC = readFileSync(join(ROOT, 'src/components/DebugPanel.tsx'), 'utf8')

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

const px = (v: string | undefined): number => {
  const m = /^(\d+)px$/.exec(v ?? '')
  return m ? Number(m[1]) : Number.NaN
}

describe('canvas toolbar chrome geometry (contract v3.1 rows 32 / 25)', () => {
  it('POSITIVE CONTROL: the reader finds rules known to exist, with their values', () => {
    expect(rule('.surface').left).toBe('13px')
    expect(rule('.surface').position).toBe('fixed')
    expect(rule('.iconButton').width).toBe('29px')
    // contract `.canvas-tools{top:21px}` measured from the canvas area, whose
    // top is the app bar's bottom.
    expect(rule('.sidebar').top).toBe('calc(var(--topbar-h) + 21px)')
  })

  it('⭐ row 32: the shared toolbar surface takes the contract radius, 12px', () => {
    expect(rule('.surface')['border-radius']).toBe('12px')
  })

  it('the radius is declared ONCE, on the shared surface — neither toolbar overrides it', () => {
    expect(rule('.sidebar')['border-radius']).toBeUndefined()
    expect(rule('.viewportControls')['border-radius']).toBeUndefined()
  })

  it('⭐ row 25: the viewport controls sit 40px off the bottom (`.zoom-tools{bottom:40px}`)', () => {
    expect(rule('.viewportControls').bottom).toBe('40px')
  })

  /**
   * ⭐ DESIGN-GAP #13 (26 Sep 2026) MOVED THE BUTTONS THEMSELVES, which this file
   * used to pin as a contrast ("buttons stay 32px circles"). v3.1
   * `.canvas-tools{left:13px;padding:5px;gap:2px}` and `.canvas-tools button{
   * width:29px;height:31px;border:0;border-radius:6px}` — both toolbars, since
   * `.zoom-tools` is a `.canvas-tools`.
   */
  it('⭐ #13: flat 29x31 radius-6 buttons with no border, in a 5px-padded, 2px-gap panel at left 13', () => {
    for (const sel of ['.iconButton', '.iconButtonActive']) {
      expect(rule(sel).width, sel).toBe('29px')
      expect(rule(sel).height, sel).toBe('31px')
      expect(rule(sel)['border-radius'], sel).toBe('6px')
      expect(rule(sel).border, sel).toBe('0')
    }
    expect(rule('.surface').left).toBe('13px')
    expect(rule('.surface').padding).toBe('5px')
    expect(rule('.surface').gap).toBe('2px')
    // The upper toolbar keeps its TOP anchor; only the lower one has a bottom.
    expect(rule('.sidebar').bottom).toBeUndefined()
  })

  it('#13: the contract’s panel material — opaque panel, the chrome line, the 7px shadow', () => {
    expect(rule('.surface').background).toBe('var(--bg-panel)')
    expect(rule('.surface').border).toBe('1px solid #DDD8D0')
    expect(rule('.surface')['box-shadow']).toBe('0 2px 7px rgba(51, 51, 51, 0.067)')
  })

  it('does not collide with the band: its bottom-left cell starts right of the toolbar, whatever its height', () => {
    // The overlay band's bottom-left cell (the lens info panel) starts at
    // OVERLAY_BAND_LEFT_PAD. The toolbar's right edge is its `left` plus the
    // content-sized panel: 29px buttons + 2 x 5px padding + 2 x 1px border.
    // Moving the toolbar VERTICALLY cannot reach a cell that starts to its right.
    const panelWidth = px(rule('.iconButton').width) + 2 * px(rule('.surface').padding) + 2
    const toolbarRight = px(rule('.surface').left) + panelWidth
    expect(toolbarRight).toBe(54) // positive control on the reads: 13 + 41
    expect(OVERLAY_BAND_LEFT_PAD).toBeGreaterThan(toolbarRight)
  })

  it('the diagnostics launcher still clears the toolbar it sits above', () => {
    // `DebugPanel` (staging `?diag` only) is anchored above this toolbar by a
    // number: the toolbar's measured height (320px at 1280×800, recorded in that
    // file) plus its bottom offset plus a 6px gap. Moving the offset without it
    // would put the launcher over the zoom read-out.
    const debugBottom = Number(/Clears CanvasViewportControls[\s\S]*?bottom:\s*(\d+),/.exec(DEBUG_PANEL_SRC)?.[1])
    expect(Number.isFinite(debugBottom), 'the DebugPanel bottom anchor was not found').toBe(true)
    const MEASURED_TOOLBAR_HEIGHT_PX = 320
    const GAP_PX = 6
    expect(debugBottom).toBe(px(rule('.viewportControls').bottom) + MEASURED_TOOLBAR_HEIGHT_PX + GAP_PX)
  })
})
