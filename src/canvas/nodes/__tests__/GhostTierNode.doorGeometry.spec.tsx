/**
 * ⭐⭐ THE DOOR'S BOX IS A FUNCTION OF THE SAME CONSTANT ITS FONT IS.
 *
 * ── THE DEFECT, MEASURED BEFORE THIS PR CHANGED A WORD ──
 *
 * Canvas label text carries `--canvas-label-scale`, which reaches
 * `MAX_LABEL_COUNTER_SCALE` (2) at exactly `LABEL_LEGIBLE_ZOOM` — and that is
 * where a post-draft auto-fit parks, because `useFitViewOnLayoutVersion` passes
 * that value as `minZoom`. So the bound is the view the PRODUCT picks, not a
 * corner case.
 *
 * At that bound, in a real browser (Chromium, Inter loaded, 3 Sep 2026), the
 * OLD card needed **75px of content in a 61px box** — all four of "Another
 * option / factor / risk / outcome" overflowed a 132 × 64 door with the OLD
 * copy. That is `#758`'s defect ("the font grew; the box did not") reproduced
 * on the one affordance nothing had sized for the bound, while
 * `nodeLayoutConstants.ts` has done exactly that for node titles since 17 Aug.
 *
 * ── WHAT THIS FILE IS, AND IS NOT, EVIDENCE ABOUT ──
 *
 * ⚠ jsdom HAS NO LAYOUT, so nothing here proves anything renders at any size
 * (CLAUDE.md trap 3). This asserts the ARITHMETIC — that the box is derived
 * from `MAX_LABEL_COUNTER_SCALE` and not hand-tuned — and that the derived
 * numbers reach the element's style. It is named as arithmetic for the same
 * reason `renderedLabelPx` exists: a passing DOM assertion about size is a
 * claim jsdom cannot support. The browser measurement is recorded in the PR and
 * in `GhostTierNode.tsx`'s own header.
 *
 * ⚠ THE MUTANT THAT MUST BITE: replace either export with the literal it
 * currently equals and the derivation tests below go RED, because they compute
 * the expectation from `MAX_LABEL_COUNTER_SCALE` at a DIFFERENT value. A test
 * asserting `GHOST_DOOR_W_PX === 187` would pass against a hardcoded 187 and
 * would be the hand-maintained mirror this whole file exists to prevent.
 *
 * ── ⭐⭐ 30 SEP 2026: THE DOOR IS AN ICON-ONLY BUTTON (Paul: "Those could be
 * icons with hover states … save space with them, but make them visible and
 * easy to use") ──
 *
 * `GhostTierNode` now renders `RowEndPromptIcon`: a 64 × 64 round button with no
 * visible text. The question is its accessible name AND its DS tooltip, verbatim.
 * So the rows below pin the ICON's contract — the ruled 64 square the layout
 * reserves (`ROW_PROMPT_W` / `ROW_PROMPT_H`), the name and tooltip, the `[24]`
 * glyph, and the DS chrome — while the three-line tile arithmetic is kept as the
 * record it now is (`ROW_PROMPT_TILE_H`), still derived, still mutant-checked.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import {
  GhostTierNode,
  GHOST_TIER_TESTID,
  GHOST_DOOR_W_PX,
  GHOST_DOOR_MIN_H_PX,
} from '../GhostTierNode'
import { ROW_PROMPT_W, ROW_PROMPT_H, ROW_PROMPT_LINES, ROW_PROMPT_TILE_H } from '../../utils/nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE, LABEL_LEGIBLE_ZOOM, labelCounterScale } from '../../utils/zoomLegibility'
import { GHOST_TIERS } from '../../utils/ghostTiers'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../shared/canvasGlyphScale'
import { NODE_TOOLTIP_DELAY_MS } from '../shared/nodeTooltip'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const props = (data: Record<string, unknown>) =>
  ({ id: '__ghost-risk__', type: 'ghost-tier', data, selected: false, dragging: false,
     zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0 }) as unknown as NodeProps

/* The chrome the card carries, restated here ON PURPOSE: this file is the
 * independent second opinion on the component's arithmetic, so it must not
 * import the component's own private parts and agree with itself. Read off the
 * rendered markup (6px padding, 1.5px dashed border, `typography.edgeLabel` =
 * 11px, line-height 1.35), which the render test below also checks — so a
 * style change cannot leave this restatement quietly wrong.
 *
 * ⭐ S4 (24 Sep 2026): the door is the ROW-END PROMPT again, at the width
 * Experience Design ruled ("160px is approved as the target width and they
 * count inside the row budget", #63 5806266691). The width is therefore a RULED
 * number, shared with the layout that reserves it; only the HEIGHT is derived
 * from the counter-scale.
 *
 * ⚠ 30 Sep 2026: these five numbers now describe the RETIRED tile only
 * (`ROW_PROMPT_TILE_H`); the icon renders none of this chrome, which the render
 * rows below assert (no dashed border, no label span). */
const PAD_PX = 6
const BORDER_PX = 1.5
const DECLARED_LABEL_PX = 11
const LINE_HEIGHT = 1.35
const LINES = 3

describe('the door is the row slot the layout reserved, and its height is derived from the bound', () => {
  it('the bound is reached at the zoom a product auto-fit parks at', () => {
    // The premise the height rests on, pinned in-test rather than assumed
    // (CLAUDE.md trap 13b).
    expect(MAX_LABEL_COUNTER_SCALE).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(1)
  })

  /** The ruled icon size, written as the RULING says it (Paul, 30 Sep 2026: 64,
   *  "42px at the 0.65 landing zoom" — DS §9.9's 44px target, as near as the canvas
   *  allows) — never read back from the constant under test. */
  const RULED_ICON_W = 64

  it('the width is the ruled icon width — the SAME number `layoutGraph` reserves (Paul 30 Sep: 64; was ED S4\'s 160 tile)', () => {
    expect(ROW_PROMPT_W).toBe(RULED_ICON_W)
    expect(GHOST_DOOR_W_PX).toBe(ROW_PROMPT_W)
  })

  it('the icon is SQUARE: the height the layout reserves is its width', () => {
    expect(ROW_PROMPT_H).toBe(ROW_PROMPT_W)
    expect(GHOST_DOOR_MIN_H_PX).toBe(ROW_PROMPT_H)
  })

  it('RECORD: the retired tile\'s floor held THREE lines of counter-scaled label plus unscaled chrome', () => {
    // TEXT scales, CHROME does not — the distinction `NODE_TITLE_RECLAIMED_PX`
    // records after a first cut multiplied the chrome and doubled it. The tile's
    // number is kept (`ROW_PROMPT_TILE_H`, 89 at the 1.64 bound) and still derived.
    const expected = Math.ceil(
      LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE + PAD_PX * 2 + BORDER_PX * 2,
    )
    expect(ROW_PROMPT_TILE_H).toBe(expected)
    // …and the icon does not inherit it: the reserved height is the 64 square.
    expect(GHOST_DOOR_MIN_H_PX).not.toBe(ROW_PROMPT_TILE_H)
  })

  /**
   * ⚠⚠ A TRIPWIRE, NOT A FIT GUARD. Three lines is what the four questions need
   * in a 160 box at the bound: `GhostTierNode`'s 3 Sep browser measurement
   * recorded that the risk and outcome questions already spill to THREE lines
   * at 80 declared px of measure, and a 160 box leaves less. jsdom cannot check
   * the fit (no text metrics, CLAUDE.md trap 3); this only makes a change to
   * the line budget impossible to make silently.
   */
  it('TRIPWIRE: the line budget is three', () => {
    expect(
      ROW_PROMPT_LINES,
      'ROW_PROMPT_LINES is the number of lines the four row-end questions take in a 160 box at the ' +
        'counter-scale bound. If you change it, the box, or a tier label, re-measure in a real browser ' +
        '(e2e/geometry/ghostDoorVisibility.measure.ts) — the layout reserves this height for the ' +
        'stacked Outcome + Risk column.',
    ).toBe(3)
  })

  /**
   * ⚠ SOURCE-TEXT GUARD. No behavioural test can tell a literal from a
   * derivation that currently evaluates to the same number, so the property is
   * checked where it lives: the height is derived from the counter-scale in
   * `nodeLayoutConstants.ts`, and the door re-exports it by NAME.
   */
  it('SOURCE GUARD: the height is the icon\'s width BY NAME, the tile record is a derivation, and the door re-exports the layout\'s constants by name', () => {
    const constants = readFileSync(resolve(__dirname, '..', '..', 'utils', 'nodeLayoutConstants.ts'), 'utf8')
    // ⚠ BOUNDED TO THE DECLARATION (30 Sep 2026). This sliced from
    // `export const ROW_PROMPT_H =` to the next `\n)` ANYWHERE in the file, so once
    // ROW_PROMPT_H became a one-line `= ROW_PROMPT_W` the slice ran on into later
    // declarations and found MAX_LABEL_COUNTER_SCALE there: a pass on text that
    // was not the declaration. Each slice now ends where its own declaration does.
    const hStart = constants.indexOf('export const ROW_PROMPT_H =')
    expect(hStart, 'ROW_PROMPT_H is not declared').toBeGreaterThan(-1)
    const hDecl = constants.slice(hStart, constants.indexOf('\n', hStart))
    expect(hDecl.replace('export const ROW_PROMPT_H =', '').trim(), 'ROW_PROMPT_H is not the icon width by name').toBe('ROW_PROMPT_W')
    const tStart = constants.indexOf('export const ROW_PROMPT_TILE_H =')
    expect(tStart, 'ROW_PROMPT_TILE_H is not declared').toBeGreaterThan(-1)
    const tDecl = constants.slice(tStart, constants.indexOf('\n)', tStart))
    expect(tDecl, 'ROW_PROMPT_TILE_H is not derived from the counter-scale').toContain('MAX_LABEL_COUNTER_SCALE')
    expect(tDecl, 'the tile slice ran past its own declaration').not.toContain('export const ROW_PROMPT_H')
    const door = readFileSync(resolve(__dirname, '..', 'GhostTierNode.tsx'), 'utf8')
    expect(door).toMatch(/export const GHOST_DOOR_W_PX = ROW_PROMPT_W\b/)
    expect(door).toMatch(/export const GHOST_DOOR_MIN_H_PX = ROW_PROMPT_H\b/)
    for (const name of ['GHOST_DOOR_W_PX', 'GHOST_DOOR_MIN_H_PX']) {
      const rest = door.slice(door.indexOf(`export const ${name} =`))
      expect(rest.slice(0, rest.indexOf('\n')).replace(`export const ${name} =`, ''), `${name} is a bare literal`).not.toMatch(/^\s*-?\d+(\.\d+)?\s*$/)
    }
  })

  it('DETECTOR CONTRACT: the source guard rejects the literal spelling', () => {
    // The exact mutant that survived the previous version of this test, run
    // through the same predicate. Without this, "the source mentions the
    // constant" is compatible with a predicate that matches anything.
    const literal = 'export const GHOST_DOOR_W_PX = 187'
    expect(literal).not.toContain('MAX_LABEL_COUNTER_SCALE')
    expect(literal.replace('export const GHOST_DOOR_W_PX =', '')).toMatch(
      /^\s*-?\d+(\.\d+)?\s*$/,
    )
  })

  it('the OLD hand-tuned box could not have held the copy at the bound — the S4 tile did, and the icon carries no copy', () => {
    // 132 x 64 with a 1.5px border left 61px of content box; the browser
    // measured the old nouns needing 75px there (16px icon, 4px gap, two lines
    // of the then-11px/1.25 label at the bound). Recorded as arithmetic so the
    // regression has a number, not an anecdote — and the S4 TILE floor
    // (`ROW_PROMPT_TILE_H`) cleared it. Since 30 Sep the door is an icon with NO
    // visible copy (the question is its name and tooltip; the render rows below
    // pin that), so there is no copy left to overflow its box.
    const OLD_H = 64
    const contentBox = OLD_H - BORDER_PX * 2
    // At the THEN bound, 2 — the counter-scale when the browser measured it. Since
    // 27 Sep 2026 the text bound is the 1.36 landing ceiling; the history is not.
    const THEN_BOUND = 2
    const neededThen = 16 + 4 + 2 * 11 * 1.25 * THEN_BOUND
    expect(neededThen).toBeGreaterThan(contentBox)
    expect(ROW_PROMPT_TILE_H - BORDER_PX * 2 - PAD_PX * 2).toBeGreaterThanOrEqual(
      LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE,
    )
  })
})

/** Long enough for the 300ms open delay plus floating-ui's async positioning. */
const OPEN = { timeout: NODE_TOOLTIP_DELAY_MS + 1500 }

/** Hover `el` and return the DS tooltip's text — asserting it was ABSENT first,
 *  so the reading is evidence about hovering, not about rendering. */
async function hoverText(el: HTMLElement): Promise<string> {
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.mouseEnter(el)
  const tip = await screen.findByRole('tooltip', {}, OPEN)
  return tip.textContent ?? ''
}

describe('the rendered door', () => {
  it('the tier question it was handed is its accessible name AND its tooltip, verbatim — with no visible copy', async () => {
    const risk = GHOST_TIERS.find((t) => t.siblingType === 'risk')!
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props({ label: risk.label, prompt: 'q', tier: 'risk' })} />
      </ReactFlowProvider>,
    )
    // Bound to the tier's own string by identity, not to a substring another
    // door could also satisfy.
    const door = screen.getByTestId(GHOST_TIER_TESTID)
    expect(door).toHaveAttribute('role', 'button')
    expect(door).toHaveAttribute('aria-label', risk.label)
    expect(door).toHaveAttribute('data-tier', 'risk')
    // Icon-only (DS §9.9): nothing visible to read — the tooltip says it.
    expect(door.textContent?.trim()).toBe('')
    expect(await hoverText(door)).toBe(risk.label)
  })

  it('carries the reserved 64 square, and the DS icon-button chrome', () => {
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props({ label: 'What else could go wrong?', prompt: 'q', tier: 'risk' })} />
      </ReactFlowProvider>,
    )
    const door = screen.getByTestId(GHOST_TIER_TESTID) as HTMLElement
    // The BOX is the wrapper the node renders: exactly the slot the layout reserved.
    const box = door.parentElement as HTMLElement
    expect(box.style.width).toBe(`${GHOST_DOOR_W_PX}px`)
    expect(box.style.height).toBe(`${GHOST_DOOR_MIN_H_PX}px`)
    // …and the button fills it: a round, outlined neutral on the panel fill.
    const cls = door.className.split(/\s+/)
    for (const c of ['absolute', 'inset-0', 'rounded-full', 'bg-panel', 'border', 'border-text-light', 'text-text-light', 'shadow-1']) {
      expect(cls, c).toContain(c)
    }
    // DS §6.3 focus ring, always visible on keyboard focus.
    for (const c of ['focus-visible:ring-2', 'focus-visible:ring-offset-2', 'focus-visible:ring-info']) {
      expect(cls, c).toContain(c)
    }
    // The dashed tile chrome is gone, not merely overridden.
    expect(door.style.border).toBe('')
    expect(door.querySelector('span')).toBeNull()
    // The glyph: `Plus` at the counter-scaled 24, decorative.
    const glyph = door.querySelector('svg') as SVGElement
    expect(glyph.getAttribute('class')).toContain('lucide-plus')
    expect(glyph.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[24])
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
  })

  it('handed no label, renders none rather than falling back to a noun', () => {
    // The old fallback was `data.label ?? 'Add'`. A generic fallback is exactly
    // how a category label returns after the questions land.
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props({ prompt: 'q', tier: 'risk' })} />
      </ReactFlowProvider>,
    )
    const door = screen.getByTestId(GHOST_TIER_TESTID)
    expect(door.textContent?.trim()).toBe('')
    expect(door).not.toHaveTextContent(/add/i)
    // …and no generic accessible name either.
    expect(door).not.toHaveAttribute('aria-label')
  })
})
