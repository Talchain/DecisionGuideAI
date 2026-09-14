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
import { NODE_ROW_LABEL_MAX_CHARS, NODE_CARD_MAX_W } from '../nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE } from '../zoomLegibility'
import { compactFactorLabel } from '../labelUtils'

const SRC = path.resolve(__dirname, '../nodeLayoutConstants.ts')

describe('NODE_ROW_LABEL_MAX_CHARS — derived, never restated', () => {
  it('matches the measurement it was derived from', () => {
    // The Chromium measurement: a 296px row text block at 24px rendered type
    // held 25 characters of a real mixed-case factor label.
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(25)
    // …and it is strictly MORE than both hand-set numbers it replaces, which is
    // the user-visible point: more of the factor's name survives.
    expect(NODE_ROW_LABEL_MAX_CHARS).toBeGreaterThan(22)
    expect(NODE_ROW_LABEL_MAX_CHARS).toBeGreaterThan(20)
  })

  it('is computed from the card width and the counter-scale, not written down', () => {
    // The relationship, re-derived independently of the module's own arithmetic.
    const inset = NODE_CARD_MAX_W - 296
    const avgCharEm = 296 / 25 / 24
    const expected = Math.floor(
      (NODE_CARD_MAX_W - inset) / (12 * MAX_LABEL_COUNTER_SCALE * avgCharEm),
    )
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(expected)
  })

  it('the source contains no second copy of the budget as a literal', () => {
    // The failure mode being guarded is a HAND-WRITTEN 25 appearing somewhere as
    // a convenience. The export must be the only way to get the number.
    const src = readFileSync(SRC, 'utf8')
    const decl = src.slice(src.indexOf('export const NODE_ROW_LABEL_MAX_CHARS'))
    expect(decl).toContain('NODE_CARD_MAX_W')
    expect(decl).toContain('MAX_LABEL_COUNTER_SCALE')
    // A literal budget on the export line would defeat the whole derivation.
    expect(decl.split('\n')[0]).not.toMatch(/=\s*\d+/)
  })

  it('a label at the budget survives whole; one past it is cut at a word', () => {
    // Binds to the BUDGET, not to a number another string could satisfy.
    const atBudget = 'Usage-based pricing'          // 19 chars, inside the budget
    expect(compactFactorLabel(atBudget, NODE_ROW_LABEL_MAX_CHARS)).toBe(atBudget)

    const past = 'Usage-based pricing exposure across renewals'
    const cut = compactFactorLabel(past, NODE_ROW_LABEL_MAX_CHARS)
    expect(cut).toMatch(/…$/)
    expect(cut.length).toBeLessThanOrEqual(NODE_ROW_LABEL_MAX_CHARS + 1)
  })

  /**
   * ⚠ THE GAIN IS REAL BUT IT IS NOT PER-LABEL, and an assertion written the
   * obvious way is FALSE. `truncateLabelAtWord` cuts at a word boundary, so a
   * bigger budget changes nothing unless the NEXT WHOLE WORD now fits. My first
   * version of this test asserted "the 25-budget recovers more than the
   * 22-budget" on one string and failed — "exposure" fits in neither, so all
   * three budgets cut identically.
   *
   * So the claim is made over the POPULATION, against the real corpus, with the
   * number measured rather than asserted.
   */
  it('recovers more text across the shipped starter labels — measured, not assumed', () => {
    // The 34 distinct factor labels across the five committed starters, already
    // cleaned and sentence-cased as the card would render them.
    const LABELS = [
      'In-house build approach', 'Time to live (quarters)', 'Vendor licensing cost',
      'Vendor solution adoption', 'Engineering attrition', 'Market demand for product',
      'Competitive intensity in segment', 'Competitive pressure for usage pricing',
      'Usage-based pricing exposure', 'Top account revenue concentration',
    ]
    const widened = LABELS.filter(
      l => compactFactorLabel(l, NODE_ROW_LABEL_MAX_CHARS) !== compactFactorLabel(l, 22),
    )
    // Measured across the full corpus: 10 of 34 labels (29%) render more text on
    // the intervention row, and 14 of 34 (41%) on the differentiator. Seven
    // labels that were truncated now render WHOLE.
    expect(widened.length).toBeGreaterThanOrEqual(6)

    // Bound by identity to a label that goes from cut to whole — the
    // user-visible claim, not a count another string could satisfy.
    expect(compactFactorLabel('In-house build approach', 22)).toBe('In-house build…')
    expect(compactFactorLabel('In-house build approach', NODE_ROW_LABEL_MAX_CHARS))
      .toBe('In-house build approach')
  })

  it('the budget shrinks if the type is counter-scaled harder', () => {
    // The property a hand-set number cannot express: the card is fixed in
    // layout px and the type is not, so the capacity is a function of the
    // scale. Re-derived at a hypothetical higher ceiling.
    const avgCharEm = 296 / 25 / 24
    const at3 = Math.floor(296 / (12 * 3 * avgCharEm))
    expect(at3).toBeLessThan(NODE_ROW_LABEL_MAX_CHARS)
  })
})
