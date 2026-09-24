/**
 * THE ROW LABEL BUDGET IS DERIVED FROM THE CARD AND THE TYPE — and stays that way.
 *
 * This canvas has now shipped the SAME defect three times: a character count cut
 * into text that lives in a box measured in pixels, sized once against a card
 * width and never revisited when the card moved.
 *
 *     ConnRow                30 chars   -> replaced by CSS width   (#1531)
 *     edge-label half-width  80 px      -> derived from type       (#1560)
 *     compactFactorLabel     22 / 20    -> derived here
 *
 * The third one's own comment said *"revisit if the card width changes
 * materially"*. `NODE_CARD_MAX_W` went 320 -> 336 at #1527 and nobody did —
 * which is the estate's dominant defect (CLAUDE.md trap 12) written as a
 * standing instruction to a human.
 *
 * ⛔ A GUARD THAT ONLY CHECKS THE NUMBER IS A MIRROR OF THE MIRROR. These tests
 * assert the RELATIONSHIP — that the budget MOVES when the card or the type
 * moves — not that it equals 25 today. A test pinning 25 would go stale in
 * exactly the way the constant it guards just did.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NODE_ROW_LABEL_MAX_CHARS, NODE_CARD_MAX_W, REPEATED_CARD_W } from '../nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE } from '../zoomLegibility'
import { compactFactorLabel } from '../labelUtils'

const SRC = path.resolve(__dirname, '../nodeLayoutConstants.ts')

/** The Chromium measurement the budget is derived from (pricing-model, 1600x1000):
 *  a 336 card held a 296px row text block, and at 24px rendered type that block
 *  held 25 characters of a real mixed-case factor label. */
const MEASURED_CARD = 336
const MEASURED_BLOCK = 296
const MEASURED_CHARS = 25

/**
 * ⭐ S4 (24 Sep 2026): THE CARD MOVED, SO THE BUDGET MOVED — WHICH IS THIS FILE'S
 * WHOLE POINT. Experience Design put option cards at `REPEATED_CARD_W` (260), so
 * the row a label is cut for is 76 units narrower than the 336 it was measured
 * in, and the budget follows it 25 → 18. A budget left on 336 would hand a 260
 * card a label ~76 units wider than its row: horizontal overflow, the thing
 * `nodeTextClipping.visual.spec.ts` catches in a browser.
 */
describe('NODE_ROW_LABEL_MAX_CHARS — derived, never restated', () => {
  it('matches the measurement, re-applied to the card the rows now render in', () => {
    const inset = MEASURED_CARD - MEASURED_BLOCK
    const perChar = MEASURED_BLOCK / MEASURED_CHARS
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(Math.floor((REPEATED_CARD_W - inset) / perChar))
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(18)
    // It MOVED with the card — strictly below the 25 a 336 card affords.
    expect(NODE_ROW_LABEL_MAX_CHARS).toBeLessThan(MEASURED_CHARS)
  })

  it('is computed from the card width and the counter-scale, not written down', () => {
    // The relationship, re-derived independently of the module's own arithmetic.
    const inset = NODE_CARD_MAX_W - MEASURED_BLOCK
    const avgCharEm = MEASURED_BLOCK / MEASURED_CHARS / 24
    const expected = Math.floor(
      (REPEATED_CARD_W - inset) / (12 * MAX_LABEL_COUNTER_SCALE * avgCharEm),
    )
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(expected)
  })

  it('the source contains no second copy of the budget as a literal', () => {
    // The failure mode being guarded is a HAND-WRITTEN number appearing somewhere
    // as a convenience. The export must be the only way to get the number, and
    // it must name the card it is spent in.
    const src = readFileSync(SRC, 'utf8')
    const decl = src.slice(src.indexOf('export const NODE_ROW_LABEL_MAX_CHARS'))
    expect(decl.slice(0, decl.indexOf('\n)'))).toContain('REPEATED_CARD_W')
    expect(decl.slice(0, decl.indexOf('\n)'))).toContain('MAX_LABEL_COUNTER_SCALE')
    // A literal budget on the export line would defeat the whole derivation.
    expect(decl.split('\n')[0]).not.toMatch(/=\s*\d+/)
  })

  it('a label at the budget survives whole; one past it is cut at a word', () => {
    // Binds to the BUDGET, not to a number another string could satisfy.
    const atBudget = 'Trial conversion'             // 16 chars, inside the budget
    expect(compactFactorLabel(atBudget, NODE_ROW_LABEL_MAX_CHARS)).toBe(atBudget)

    const past = 'Usage-based pricing exposure across renewals'
    const cut = compactFactorLabel(past, NODE_ROW_LABEL_MAX_CHARS)
    expect(cut).toMatch(/…$/)
    expect(cut.length).toBeLessThanOrEqual(NODE_ROW_LABEL_MAX_CHARS + 1)
  })

  /**
   * ⚠ WHAT S4 COSTS, STATED ON THE REAL CORPUS RATHER THAN HIDDEN: a narrower
   * card cuts more labels. What must NOT change is HOW they are cut — at a word,
   * never mid-word, and never longer than the row.
   */
  it('on the shipped labels the narrower row cuts at a WORD, never mid-word, never past the row', () => {
    const LABELS = [
      'In-house build approach', 'Time to live (quarters)', 'Vendor licensing cost',
      'Vendor solution adoption', 'Engineering attrition', 'Market demand for product',
      'Competitive intensity in segment', 'Competitive pressure for usage pricing',
      'Usage-based pricing exposure', 'Top account revenue concentration',
    ]
    let cutCount = 0
    for (const l of LABELS) {
      const out = compactFactorLabel(l, NODE_ROW_LABEL_MAX_CHARS)
      expect(out.length, l).toBeLessThanOrEqual(NODE_ROW_LABEL_MAX_CHARS + 1)
      if (out.endsWith('…')) {
        cutCount++
        const kept = out.slice(0, -1)
        // A word boundary: the original continues with a space after what was kept.
        expect(l.startsWith(kept), `${l} → ${out}`).toBe(true)
        expect(l.charAt(kept.length), `${l} → ${out} was cut mid-word`).toBe(' ')
      }
    }
    // CONTRAST: the corpus really exercises the cut, or the loop above is vacuous.
    expect(cutCount).toBeGreaterThan(0)
    // Bound by identity to one label the S4 row now cuts.
    expect(compactFactorLabel('In-house build approach', NODE_ROW_LABEL_MAX_CHARS)).toBe('In-house build…')
  })

  it('the budget shrinks if the type is counter-scaled harder', () => {
    // The property a hand-set number cannot express: the card is fixed in
    // layout px and the type is not, so the capacity is a function of the
    // scale. Re-derived at a hypothetical higher ceiling, in the same row.
    const avgCharEm = MEASURED_BLOCK / MEASURED_CHARS / 24
    const row = REPEATED_CARD_W - (MEASURED_CARD - MEASURED_BLOCK)
    const at3 = Math.floor(row / (12 * 3 * avgCharEm))
    expect(at3).toBeLessThan(NODE_ROW_LABEL_MAX_CHARS)
  })
})
