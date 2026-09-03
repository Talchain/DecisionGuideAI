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
  GHOST_DOOR_TEXT_MEASURE_PX,
} from '../GhostTierNode'
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
 * import the component's own private parts and agree with itself. These four
 * are read off the rendered markup's Tailwind classes (`w-4`, `gap-1`, `px-1`)
 * and the border, which the assertions below also check are still what they
 * say — so a class change cannot leave this restatement quietly wrong. */
const ICON_PX = 16
const GAP_PX = 4
const PAD_X_PX = 4
const BORDER_PX = 1.5
const DECLARED_LABEL_PX = 11
const LINE_HEIGHT = 1.25
const MAX_LINES = 2

describe('the door is sized for the counter-scale bound, not hand-tuned', () => {
  it('the bound is reached at the zoom a product auto-fit parks at', () => {
    // The premise the geometry rests on, pinned in-test rather than assumed
    // (CLAUDE.md trap 13b): if this stops being true the sizing below is
    // answering a question nobody is asking any more.
    expect(MAX_LABEL_COUNTER_SCALE).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(1)
  })

  /**
   * ⚠ THIS TEST WAS A TAUTOLOGY UNTIL ROUND 2, IN A WAY ITS OWN PR CLAIMED TO
   * HAVE FIXED. It recovered the declared measure by DIVIDING `GHOST_DOOR_W_PX`
   * by `MAX_LABEL_COUNTER_SCALE` and multiplying it back — an identity that
   * agrees with any value whose `(W − 11)` is even. The PR reported replacing
   * it; what was actually added was the SOURCE GUARD below, and this identity
   * stayed. A correcting change reads as already-audited, which is exactly how
   * it survived a round.
   *
   * It is non-vacuous now because the expectation's right-hand side is built
   * from an INDEPENDENTLY DECLARED export, not from the export under test. It
   * REDs if the width drifts from the measure, or if the chrome is multiplied
   * by the counter-scale (the `NODE_TITLE_RECLAIMED_PX` arithmetic error).
   *
   * ⚠ It does NOT red on `GHOST_DOOR_TEXT_MEASURE_PX` changing: both sides move
   * together, which is the point — this test asks "is the width DERIVED from
   * the measure?", and the tripwire below asks "is the measure STILL 88?".
   * Two different questions; they are kept apart deliberately (CLAUDE.md trap
   * 21) rather than folded into one assertion that answers neither cleanly.
   */
  it('the width is the DECLARED text measure at the bound plus unscaled chrome', () => {
    // TEXT scales, CHROME does not — the distinction `NODE_TITLE_RECLAIMED_PX`
    // records after the first cut multiplied the chrome and doubled it.
    expect(GHOST_DOOR_W_PX).toBe(
      GHOST_DOOR_TEXT_MEASURE_PX * MAX_LABEL_COUNTER_SCALE + PAD_X_PX * 2 + BORDER_PX * 2,
    )
    // And the chrome is genuinely unscaled: at a different counter-scale the
    // width moves by the measure alone. Pins the relation's SHAPE, so a test
    // that happens to agree arithmetically cannot agree for the wrong reason.
    expect(GHOST_DOOR_W_PX - GHOST_DOOR_TEXT_MEASURE_PX * MAX_LABEL_COUNTER_SCALE).toBe(
      PAD_X_PX * 2 + BORDER_PX * 2,
    )
  })

  /**
   * ⚠⚠ A TRIPWIRE, NOT A FIT GUARD — AND THE DISTINCTION IS THE WHOLE POINT.
   *
   * `GHOST_DOOR_TEXT_MEASURE_PX` is hand-measured in a real browser. Before
   * round 2 it was referenced NOWHERE outside its own declaration: mutating it
   * `88 → 60` (measured to spill two doors to three lines) left 115/115 tests
   * green across 11 ghost-touching specs, while a comment above it claimed this
   * very file "REDs if a label outgrows it".
   *
   * This assertion REDs on that mutation. That is ALL it does. It knows nothing
   * about the copy: it would bless 88 for a sentence twice as long. Whether the
   * four questions FIT at this measure is a text-metrics question jsdom cannot
   * answer at all (CLAUDE.md trap 3) — a real fit guard needs a browser and
   * belongs in `e2e/geometry/ghostDoorVisibility.measure.ts`. Rowed; not this
   * PR. A weaker jsdom guard manufactured to fill that space would be the same
   * defect wearing a passing test.
   *
   * So this is a hand-maintained mirror, ON PURPOSE, and named as one: its job
   * is to make a change to the measure IMPOSSIBLE TO MAKE SILENTLY, forcing
   * whoever moves it to re-measure and to move this line too.
   */
  it('TRIPWIRE: the hand-measured text measure is still the value that was measured', () => {
    expect(
      GHOST_DOOR_TEXT_MEASURE_PX,
      'GHOST_DOOR_TEXT_MEASURE_PX is hand-measured in a browser (Chromium + Inter, 3 Sep 2026: ' +
        '88px is the narrowest measure at which all four tier questions fit two lines at the ' +
        'counter-scale bound). Nothing in jsdom can check the FIT. If you are changing this ' +
        'number, or you changed a tier label, re-measure in a real browser first — then update ' +
        'this line and the header in GhostTierNode.tsx.',
    ).toBe(88)
  })

  it('the height floor holds two lines of counter-scaled label plus unscaled chrome', () => {
    expect(GHOST_DOOR_MIN_H_PX).toBe(
      ICON_PX +
        GAP_PX +
        MAX_LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE +
        BORDER_PX * 2,
    )
  })

  /**
   * ⚠⚠ THIS IS A SOURCE-TEXT GUARD. IT WAS ADDED ALONGSIDE A TAUTOLOGY IT DID
   * NOT ACTUALLY REPLACE — corrected in round 2, see the width test above.
   *
   * The claim that stood here was that this guard REPLACED the identity-shaped
   * width test. It did not: the guard was added and the identity stayed, so the
   * file carried a correction that had not happened. Both now exist and answer
   * different questions. Proven by execution: replacing the whole derivation
   * with the bare literal `187` — the exact defect this file exists to prevent
   * — left the identity GREEN, and this guard REDs on it.
   *
   * No BEHAVIOURAL test can tell a literal `187` from a derivation that
   * currently evaluates to 187, because at runtime they are the same number.
   * The property is about the SOURCE, so the guard reads the source, exactly as
   * `zoomLegibilitySingleSource.spec.ts` does for bare zoom literals.
   *
   * ⚠ Named as a source-text guard, and it is NOT behavioural coverage — the
   * arithmetic tests above are. Both are needed: one says the numbers are
   * right, this says they will still be right when the contract moves.
   */
  it('SOURCE GUARD: both exports are written as derivations, not as literals', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'GhostTierNode.tsx'),
      'utf8',
    )
    const declOf = (name: string) => {
      const i = src.indexOf(`export const ${name} =`)
      expect(i, `${name} is not exported from GhostTierNode.tsx`).toBeGreaterThan(-1)
      // Up to the blank line that ends the declaration.
      const rest = src.slice(i)
      return rest.slice(0, rest.indexOf('\n\n'))
    }
    for (const name of ['GHOST_DOOR_W_PX', 'GHOST_DOOR_MIN_H_PX']) {
      const decl = declOf(name)
      expect(decl, `${name} does not mention MAX_LABEL_COUNTER_SCALE`).toContain(
        'MAX_LABEL_COUNTER_SCALE',
      )
      // And it is not simply the answer written down next to the constant's name.
      expect(
        decl.replace(`export const ${name} =`, ''),
        `${name} is assigned a bare literal`,
      ).not.toMatch(/^\s*-?\d+(\.\d+)?\s*$/)
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
    // measured the old nouns needing 75px there. Recorded as arithmetic so the
    // regression has a number, not an anecdote.
    const OLD_H = 64
    const contentBox = OLD_H - BORDER_PX * 2
    const neededAtBound =
      ICON_PX + GAP_PX + MAX_LINES * DECLARED_LABEL_PX * LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE
    expect(neededAtBound).toBeGreaterThan(contentBox)
    expect(GHOST_DOOR_MIN_H_PX - BORDER_PX * 2).toBeGreaterThanOrEqual(neededAtBound)
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
    expect(door.querySelector('.w-4.h-4')).not.toBeNull()
    expect(door.className).toContain('gap-1')
    expect(door.querySelector('.px-1')).not.toBeNull()
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
