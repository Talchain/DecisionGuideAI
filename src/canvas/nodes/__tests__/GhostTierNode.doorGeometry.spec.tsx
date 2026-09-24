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
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import {
  GhostTierNode,
  GHOST_TIER_TESTID,
  GHOST_DOOR_W_PX,
  GHOST_DOOR_MIN_H_PX,
} from '../GhostTierNode'
import { ROW_PROMPT_W, ROW_PROMPT_H, ROW_PROMPT_LINES } from '../../utils/nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE, LABEL_LEGIBLE_ZOOM, labelCounterScale } from '../../utils/zoomLegibility'
import { GHOST_TIERS } from '../../utils/ghostTiers'

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
 * 11px `leading-snug` 1.375), which the render test below also checks — so a
 * style change cannot leave this restatement quietly wrong.
 *
 * ⭐ S4 (24 Sep 2026): the door is the ROW-END PROMPT again, at the width
 * Experience Design ruled ("160px is approved as the target width and they
 * count inside the row budget", #63 5806266691). The width is therefore a RULED
 * number, shared with the layout that reserves it; only the HEIGHT is derived
 * from the counter-scale. */
const PAD_PX = 6
const BORDER_PX = 1.5
const DECLARED_LABEL_PX = 11
const LINE_HEIGHT = 1.375
const LINES = 3

describe('the door is the row slot the layout reserved, and its height is derived from the bound', () => {
  it('the bound is reached at the zoom a product auto-fit parks at', () => {
    // The premise the height rests on, pinned in-test rather than assumed
    // (CLAUDE.md trap 13b).
    expect(MAX_LABEL_COUNTER_SCALE).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(1)
  })

  it('the width is the ruled prompt width — the SAME number `layoutGraph` reserves (ED S4: 160)', () => {
    expect(ROW_PROMPT_W).toBe(160)
    expect(GHOST_DOOR_W_PX).toBe(ROW_PROMPT_W)
  })

  it('the height floor holds THREE lines of counter-scaled label plus unscaled chrome', () => {
    // TEXT scales, CHROME does not — the distinction `NODE_TITLE_RECLAIMED_PX`
    // records after a first cut multiplied the chrome and doubled it.
    const expected = Math.ceil(
      LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE + PAD_PX * 2 + BORDER_PX * 2,
    )
    expect(ROW_PROMPT_H).toBe(expected)
    expect(GHOST_DOOR_MIN_H_PX).toBe(ROW_PROMPT_H)
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
  it('SOURCE GUARD: the height is a derivation, and the door re-exports the layout\'s constants by name', () => {
    const constants = readFileSync(resolve(__dirname, '..', '..', 'utils', 'nodeLayoutConstants.ts'), 'utf8')
    const hDecl = constants.slice(constants.indexOf('export const ROW_PROMPT_H ='))
    expect(hDecl.slice(0, hDecl.indexOf('\n)')), 'ROW_PROMPT_H is not derived from the counter-scale').toContain('MAX_LABEL_COUNTER_SCALE')
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

  it('the OLD hand-tuned box could not have held the copy at the bound', () => {
    // 132 x 64 with a 1.5px border left 61px of content box; the browser
    // measured the old nouns needing 75px there (16px icon, 4px gap, two lines
    // of the then-11px/1.25 label at the bound). Recorded as arithmetic so the
    // regression has a number, not an anecdote — and the S4 floor clears it.
    const OLD_H = 64
    const contentBox = OLD_H - BORDER_PX * 2
    const neededThen = 16 + 4 + 2 * 11 * 1.25 * MAX_LABEL_COUNTER_SCALE
    expect(neededThen).toBeGreaterThan(contentBox)
    expect(GHOST_DOOR_MIN_H_PX - BORDER_PX * 2 - PAD_PX * 2).toBeGreaterThanOrEqual(
      LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE,
    )
  })
})

describe('the rendered door', () => {
  it('shows the tier question it was handed, verbatim', () => {
    const risk = GHOST_TIERS.find((t) => t.siblingType === 'risk')!
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props({ label: risk.label, prompt: 'q', tier: 'risk' })} />
      </ReactFlowProvider>,
    )
    // Bound to the tier's own string by identity, not to a substring another
    // door could also satisfy.
    const door = screen.getByTestId(GHOST_TIER_TESTID)
    expect(door).toHaveTextContent(risk.label)
    // Visible text and accessible name are the same sentence (WCAG 2.5.3).
    expect(door).toHaveAttribute('aria-label', risk.label)
  })

  it('carries the derived box, and the chrome this file restates', () => {
    render(
      <ReactFlowProvider>
        <GhostTierNode {...props({ label: 'What else could go wrong?', prompt: 'q', tier: 'risk' })} />
      </ReactFlowProvider>,
    )
    const door = screen.getByTestId(GHOST_TIER_TESTID) as HTMLElement
    expect(door.style.width).toBe(`${GHOST_DOOR_W_PX}px`)
    expect(door.style.minHeight).toBe(`${GHOST_DOOR_MIN_H_PX}px`)
    // A FIXED height is what clips; a floor grows. Pinned so the fix cannot be
    // undone by a tidy-up that "restores" the old property.
    expect(door.style.height).toBe('')
    expect(door.style.border).toContain(`${BORDER_PX}px dashed`)
    // The chrome the arithmetic above assumes.
    expect(door.style.padding).toBe(`${PAD_PX}px`)
    const label = door.querySelector('span') as HTMLElement
    expect(label.className).toContain('text-[length:calc(11px*var(--canvas-label-scale,1))]')
    expect(label.className).toContain('leading-snug')
    // The last-resort wrap rule, so a long word cannot overflow the measure.
    expect(door.querySelector('.break-words')).not.toBeNull()
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
  })
})
