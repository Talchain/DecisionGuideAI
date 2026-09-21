/**
 * ⭐⭐ THE CARD'S OWN NUMBER IS NOT THE SMALLEST THING ON IT.
 *
 * The node design system's governing anatomy is:
 *   "what is this -> WHAT DOES THE MODEL RECORD, AND WHO PUT IT THERE ->
 *    the useful next step"
 * and every compact board draws that middle answer at the SAME class as the
 * title (`t14 num` beside `t14`), rising to 18px expanded.
 *
 * Shipped inverted it: a 12px value under a 14px title, and 11px on the decision
 * card — whose option count is its ONLY quantity.
 *
 * ⚠ THIS IS THE MECHANISM BEHIND "THE CARDS LOOK EMPTY", and it is not a space
 * problem. Main.dc.html's own density correction measured the deployed cards at
 * 34px UNDER its height target at the camera the board actually opens at. They
 * were not short of room; they were short of WEIGHT on the element the anatomy
 * exists to foreground.
 *
 * This guard pins the RELATIONSHIP (value >= label, and not below the title),
 * not the number — so a later ratio change that keeps the anatomy intact does
 * not red, while a silent demotion back under the title does.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CANVAS_TYPE_PX, typography } from '../../src/styles/typography'

const ROOT = join(__dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(l => l.trim().length > 0)
    .join('\n')
}

describe('the value token exists and is weighted correctly', () => {
  it('POSITIVE CONTROL: the token map is populated and discriminating', () => {
    expect(Object.keys(CANVAS_TYPE_PX).length).toBeGreaterThanOrEqual(4)
    expect(CANVAS_TYPE_PX.nodeLabel).toBeLessThan(CANVAS_TYPE_PX.nodeTitle)
  })

  it('⭐ the recorded value is at least the body label, and not below the title', () => {
    expect(
      CANVAS_TYPE_PX.nodeValue,
      'the card value is smaller than ordinary body text — the anatomy puts the number the model records at the title\'s weight, not beneath it',
    ).toBeGreaterThan(CANVAS_TYPE_PX.nodeLabel)
    expect(
      CANVAS_TYPE_PX.nodeValue,
      'the card value is smaller than its own title — this is the demotion the design calls out',
    ).toBeGreaterThanOrEqual(CANVAS_TYPE_PX.nodeTitle)
  })

  it('the value class carries the counter-scale, like every canvas token', () => {
    // Without it the value would hold its px while siblings scale, so it would
    // shrink relative to the card as the camera pulls back.
    expect(typography.nodeValue).toMatch(/calc\(14px\*var\(--canvas-label-scale,1\)\)/)
  })
})

describe('the three cards that record a quantity use it', () => {
  const sites: Array<[string, string, string]> = [
    // ⚠ ANCHORED ON THE RENDER, NOT THE SYMBOL. `valueDisplay` occurs many times
    // in this file and its first occurrence is a declaration ~15,000 chars from
    // the element — the guard passed against the wrong region until a mutant run
    // reported the PRISTINE tree as failing. An anchor that is not unique is not
    // a binding (trap 19).
    //
    // ⭐ And it must be unique BY CONSTRUCTION, not by luck. This site anchored
    // on a CALL EXPRESSION, which stayed unique only while the card had exactly
    // one value affordance. The moment the value became editable on the graph
    // the card grew a second branch, the expression matched twice and the window
    // was bound to nothing — a live RED on a tree whose anatomy was intact. A
    // `data-testid` cannot go stale that way and is what both siblings already
    // use, so FactorNode now matches them instead of being the exception.
    ['FactorNode', join('src', 'canvas', 'nodes', 'FactorNode.tsx'), 'factor-recorded-value'],
    ['RiskNode', join('src', 'canvas', 'nodes', 'RiskNode.tsx'), 'risk-recorded-value'],
    ['DecisionNode', join('src', 'canvas', 'nodes', 'DecisionNode.tsx'), 'decision-node-option-count'],
  ]

  it.each(sites)('%s renders its recorded quantity at the value token', (name, path, anchor) => {
    const code = codeOnly(read(path))
    const at = code.indexOf(anchor)
    expect(at, `${name}: anchor "${anchor}" not found — this guard is reading the wrong shape`).toBeGreaterThan(-1)
    // The anchor must identify ONE place, or the window below may be measuring a
    // region that has nothing to do with the render.
    expect(
      code.split(anchor).length - 1,
      `${name}: anchor "${anchor}" is not unique, so this assertion is not bound to the render site`,
    ).toBe(1)
    const window = code.slice(Math.max(0, at - 240), at + 240)
    expect(
      window,
      `${name} renders its recorded quantity at a smaller token than the card's title. The anatomy's second question is what the model records — rendering it as a footnote is what makes these cards read as empty.`,
    ).toContain('typography.nodeValue')
  })

  // ⭐⭐ ONE READOUT, HOWEVER MANY AFFORDANCES.
  //
  // A factor's value now has two render branches — an editor where the edit has
  // a durable carrier (`factor_value_edit`) and a plain span where it does not.
  // Nothing in the type system stops those two branches formatting the SAME
  // recorded number differently, and a card that shows `Moderate` when it is
  // read-only and `0.5` when it is editable is telling the reader that the
  // affordance changed the model's content. It did not.
  //
  // So the collapse happens in exactly ONE place and both branches consume it.
  // This is the invariant the duplication broke, and it is the discriminating
  // one: inlining the expression back into either branch reds this test, while
  // the anchor test above would stay green.
  it('⭐ the estimate collapse happens ONCE and every affordance consumes it', () => {
    const code = codeOnly(read(join('src', 'canvas', 'nodes', 'FactorNode.tsx')))
    expect(
      code.split('collapseEstimateDisplay(valueDisplay)').length - 1,
      'the estimate-collapse expression is written more than once, so two affordances on one card can drift apart',
    ).toBe(1)
    expect(
      code.split('recordedValueReadout').length - 1,
      'the hoisted readout is declared but not consumed by both the editable and the read-only branch',
    ).toBeGreaterThanOrEqual(3)
  })
})
