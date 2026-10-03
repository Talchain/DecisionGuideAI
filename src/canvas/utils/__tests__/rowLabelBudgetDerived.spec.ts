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
import { NODE_ROW_AMOUNT_MAX_CHARS, NODE_ROW_LABEL_MAX_CHARS, NODE_CARD_MAX_W, REPEATED_CARD_W } from '../nodeLayoutConstants'
import { CANVAS_TYPE_PX } from '../../../styles/typography'
import { MAX_LABEL_COUNTER_SCALE } from '../zoomLegibility'
import { compactFactorLabel } from '../labelUtils'
import { buildOptionChangeRow, buildOptionNeedsInputRow, optionAmountSegmentNoWrap } from '../../nodes/shared/optionChangeRows'

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
  it('matches the measurement, re-applied to the card AND the type the rows now render in', () => {
    const inset = MEASURED_CARD - MEASURED_BLOCK
    // ⭐ 27 Sep 2026 (landing text ceiling): the measurement was taken at 24px
    // rendered type — 12px × the then-bound of 2. The type now reaches the row at
    // 12 × 1.36, so each character is narrower by 1.36 / 2 and the SAME card
    // holds more of them: 18 → 25 on the 248 card. The type moved, so the budget
    // moved — this file's whole point, in the other direction.
    // 25 → 21 (27 Sep: landing text cap 1.36 → 1.64, owner decision, #70 5859837231): 12 × 1.64.
    const MEASURED_SCALE = 2
    const perChar = (MEASURED_BLOCK / MEASURED_CHARS) * (MAX_LABEL_COUNTER_SCALE / MEASURED_SCALE)
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(Math.floor((REPEATED_CARD_W - inset) / perChar))
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(21)
    // CONTRAST: at the old bound the same card held 17 — the scale is load-bearing.
    expect(Math.floor((REPEATED_CARD_W - inset) / (MEASURED_BLOCK / MEASURED_CHARS))).toBe(17)
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
  /**
   * ⭐ BOUND TO THE OPTION CHANGE ROW ITSELF (27 Sep 2026, Canvas owner, landing
   * text cap). At 21 characters `compactFactorLabel`'s shared 0.6 fallback cut
   * "Time to live (quarters)" to "Time to live (quarter…" — its last space (12)
   * sits under 0.6 × 21. The owner's rule for OPTION CHANGE-ROW labels: a
   * whole-word cut always beats a mid-word one; the mid-word cut is kept only
   * when not even the first word fits. So this reads the label the row builders
   * publish (`buildOptionNeedsInputRow` / `buildOptionChangeRow`), not the
   * shared helper, whose fallback `DecisionNode.triageTruncation.spec` pins.
   */
  const rowLabel = (l: string) => buildOptionNeedsInputRow({ factorId: 'f', factor: { label: l }, source: null }).label

  it('on the shipped labels the narrower row cuts at a WORD, never mid-word, never past the row', () => {
    const LABELS = [
      'In-house build approach', 'Time to live (quarters)', 'Vendor licensing cost',
      'Vendor solution adoption', 'Engineering attrition', 'Market demand for product',
      'Competitive intensity in segment', 'Competitive pressure for usage pricing',
      'Usage-based pricing exposure', 'Top account revenue concentration',
    ]
    let cutCount = 0
    for (const l of LABELS) {
      const out = rowLabel(l)
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
    // 27 Sep 2026: at the 25-character budget this label (23) was whole.
    // 27 Sep: landing text cap 1.36 → 1.64, owner decision, #70 5859837231: at 21 it is cut at a word again.
    expect(rowLabel('In-house build approach')).toBe('In-house build…')
    expect(rowLabel('Competitive intensity in segment')).toBe('Competitive intensity…')
    expect(rowLabel('Time to live (quarters)')).toBe('Time to live…')
    // Both row builders read the one row-label path.
    expect(
      buildOptionChangeRow({
        factorId: 'ttl',
        target: { value: 4 },
        factor: { label: 'Time to live (quarters)' },
        baselineOptionTarget: null,
      }).label,
    ).toBe('Time to live…')
  })

  it('RED CHECK — the shared 0.6 fallback, which the row no longer uses, WOULD cut this label mid-word', () => {
    // The discriminator: the row's whole-word cut above is not what the shared
    // rule produces, so the pin cannot be satisfied by the old path.
    expect(compactFactorLabel('Time to live (quarters)', NODE_ROW_LABEL_MAX_CHARS)).toBe('Time to live (quarter…')
    expect(rowLabel('Time to live (quarters)')).not.toBe(compactFactorLabel('Time to live (quarters)', NODE_ROW_LABEL_MAX_CHARS))
    // ⚠ The mid-word cut stays where not even the first word fits the row.
    const oneToken = 'Supercalifragilisticexpialidocious uplift'
    expect(rowLabel(oneToken)).toBe(`${oneToken.slice(0, NODE_ROW_LABEL_MAX_CHARS)}…`)
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

/**
 * ⭐ THE AMOUNT NEVER BREAKS; THE LABEL YIELDS (Canvas owner, 27 Sep 2026, landing
 * text cap 1.36 → 1.64). An option row's AMOUNT is held on one line against its
 * own budget — the same measurement, card and inset as the label's, at the
 * amount's own `edgeLabel` size — not against the label's 12px budget, which the
 * cap shrank 25 → 21 until "→ 3 engineers" + its glued "no source" (23) lost its
 * `whitespace-nowrap` (`OptionNode.contractV31Polish.spec`, CI on `d000d576`).
 */
describe('NODE_ROW_AMOUNT_MAX_CHARS — the amount’s own per-line budget, derived', () => {
  const inset = MEASURED_CARD - MEASURED_BLOCK
  const perCharAt = (px: number) => (MEASURED_BLOCK / MEASURED_CHARS / 24) * px * MAX_LABEL_COUNTER_SCALE

  it('is the measurement re-applied to the amount’s own type size at the bound', () => {
    expect(NODE_ROW_AMOUNT_MAX_CHARS).toBe(Math.floor((REPEATED_CARD_W - inset) / perCharAt(CANVAS_TYPE_PX.edgeLabel)))
    // The label's budget is the same formula at 12px — so the amount never gets
    // LESS room than the label: the label is the part that yields.
    expect(NODE_ROW_LABEL_MAX_CHARS).toBe(Math.floor((REPEATED_CARD_W - inset) / perCharAt(12)))
    expect(NODE_ROW_AMOUNT_MAX_CHARS).toBeGreaterThanOrEqual(NODE_ROW_LABEL_MAX_CHARS)
  })

  it('the amount run is held whole up to its OWN budget, and wraps one past it (served cd6a82e4 still cannot overflow)', () => {
    const at = 'x'.repeat(NODE_ROW_AMOUNT_MAX_CHARS)
    expect(optionAmountSegmentNoWrap(at)).toBe(true)
    expect(optionAmountSegmentNoWrap(`${at}x`)).toBe(false)
  })

  it('RED CHECK — the served "to" run with its glued mark sits between the label budget and the amount budget', () => {
    // "→ 3 engineers" + the glue + "no source": held whole on its own budget,
    // and NOT on the label's — which is what broke it when the cap moved.
    const run = '→ 3 engineers no source'
    expect(run.length).toBeGreaterThan(NODE_ROW_LABEL_MAX_CHARS)
    expect(run.length).toBeLessThanOrEqual(NODE_ROW_AMOUNT_MAX_CHARS)
    expect(optionAmountSegmentNoWrap(run)).toBe(true)
  })
})
