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
 * ⚠ BUTTON SIZE IS DELIBERATELY NOT MOVED. The contract's `.canvas-tools
 * button` is 29×31 with no border; ours is a 32px circle whose `--border-field`
 * outline is the WCAG 1.4.11 fix recorded in the stylesheet. That is a separate
 * decision from rows 32/25 and is pinned below as a CONTRAST, so this change
 * cannot drag it along.
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
const INDEX_CSS = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
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
    expect(rule('.surface').left).toBe('12px')
    expect(rule('.surface').position).toBe('fixed')
    expect(rule('.iconButton').width).toBe('32px')
    expect(rule('.sidebar').top).toBe('calc(var(--topbar-h) + 1rem)')
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

  it('CONTRAST: buttons stay 32px circles and the left edge stays 12px — only radius and offset moved', () => {
    for (const sel of ['.iconButton', '.iconButtonActive']) {
      expect(rule(sel).width, sel).toBe('32px')
      expect(rule(sel).height, sel).toBe('32px')
      expect(rule(sel)['border-radius'], sel).toBe('999px')
    }
    expect(rule('.surface').left).toBe('12px')
    // The upper toolbar keeps its TOP anchor; only the lower one has a bottom.
    expect(rule('.sidebar').bottom).toBeUndefined()
  })

  it('does not collide with the footer: the footer’s cell starts right of the toolbar, whatever its height', () => {
    // #1999's footer draws in the overlay band's bottom-left cell, whose left
    // padding is OVERLAY_BAND_LEFT_PAD. The toolbar's right edge is its `left`
    // plus `--leftsidebar-w`. Moving the toolbar VERTICALLY cannot reach a cell
    // that starts to its right.
    const toolbarRight = px(rule('.surface').left) + Number(/--leftsidebar-w:\s*(\d+)px/.exec(INDEX_CSS)?.[1])
    expect(toolbarRight).toBe(60) // positive control on the two reads
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
