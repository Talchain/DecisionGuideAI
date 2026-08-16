/**
 * L-01(a) — the canvas toolbar must show the mode the canvas is ACTUALLY in.
 *
 * Two failure modes produced one symptom ("the icon doesn't change the actual
 * pointer behaviour; Escape is needed"). This file pins the first: the toolbar
 * icon was bound to the raw persisted `interactionMode` while every behaviour
 * prop (`panOnDrag`, `nodesDraggable`, the cursor class) was bound to
 * `effectiveMode` — so a spacebar hold moved the pointer without moving the
 * icon, and the toolbar told the user something false.
 *
 * WHAT THIS PROVES, precisely: the wiring — that ReactFlowGraph feeds the
 * toolbar the same resolved value its behaviour props consume. It is a source
 * assertion because ReactFlowGraph cannot be mounted meaningfully in jsdom,
 * and because jsdom cannot prove a cursor or a drag either way.
 *
 * WHAT A BROWSER WITNESS MUST STILL CONFIRM: that with the select tool active,
 * holding space pans AND the toolbar icon shows the hand for the duration of
 * the hold, returning to the pointer on release.
 *
 * The companion behavioural half — that LeftSidebar renders icon, tooltip,
 * aria-label and aria-pressed from that prop by identity — lives in
 * src/components/layout/__tests__/LeftSidebar.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = resolve(__dirname, '../ReactFlowGraph.tsx')

/** The `<LeftSidebar …>` element's opening tag, derived from the source. */
function readLeftSidebarProps(): string {
  const src = readFileSync(SOURCE, 'utf8')
  const open = src.indexOf('<LeftSidebar')
  expect(open, 'ReactFlowGraph must render <LeftSidebar>').toBeGreaterThan(-1)
  const close = src.indexOf('/>', open)
  expect(close, '<LeftSidebar> opening tag must terminate').toBeGreaterThan(open)
  return src.slice(open, close)
}

/** The expression bound to a named prop on that element, or null. */
function boundExpression(props: string, prop: string): string | null {
  const m = new RegExp(`\\b${prop}=\\{([^}]*)\\}`).exec(props)
  return m ? m[1].trim() : null
}

describe('canvas toolbar mode binding (L-01a)', () => {
  it('feeds the toolbar the EFFECTIVE mode, not the raw persisted mode', () => {
    const props = readLeftSidebarProps()
    expect(boundExpression(props, 'interactionMode')).toBe('effectiveMode')
  })

  it('binds the toolbar to the same value the canvas behaviour props consume', () => {
    const src = readFileSync(SOURCE, 'utf8')
    // The behaviour side: pan and node-drag both read the effective mode.
    expect(src).toContain("panOnDrag={effectiveMode === 'hand' ? true : SELECT_MODE_PAN_BUTTONS}")
    expect(src).toContain("nodesDraggable={effectiveMode === 'select'}")
    // …and the toolbar reads the identical symbol, so the two cannot diverge.
    expect(boundExpression(readLeftSidebarProps(), 'interactionMode')).toBe('effectiveMode')
  })

  it('resolves the effective mode through the shared helper, not a local copy', () => {
    const src = readFileSync(SOURCE, 'utf8')
    expect(src).toContain('resolveEffectiveInteractionMode(interactionMode, spaceHeld)')
  })

  it('releases text-entry focus when the canvas is engaged (L-01c wiring)', () => {
    const src = readFileSync(SOURCE, 'utf8')
    expect(src).toContain('onPointerDownCapture={handleCanvasPointerDownCapture}')
    expect(src).toContain('shouldReleaseTextFocusOnCanvasPointerDown(')
  })
})
