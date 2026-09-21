/**
 * ⭐⭐ THE CARD MAY NAME A RANGE ONLY WHERE ONE CAN BE SET.
 *
 * ── THE DEFECT, MEASURED ───────────────────────────────────────────────────
 * `strengthen:lehi` shipped titled *"Give {factor} a realistic range"* with a
 * button labelled **"Set a range"**, over a `canvas-focus` route that resolves
 * to `focusNodeById`: it selects the node, dims its neighbours and moves the
 * camera. It opens no editor and switches no tab.
 *
 * A range editor exists on exactly ONE surface — the canvas inspector's
 * `FactorExternalPanel`, 3 `setPriorRange` call sites — and only for a factor
 * whose category is `'external'`. `FactorControllablePanel` has 0, and all 19
 * non-test files of `model-tab-v2` have 0; its `proposePriorRange` contract is
 * declared once with zero implementations. Counted on two real captures:
 * **1 external of 7 categorised factors.**
 *
 * ── THE RULING THIS APPLIES, WHICH ALREADY EXISTED ─────────────────────────
 * `FactorControllablePanel.noScaleRemedyIsTheUnitPath.spec.tsx`: *"The remedy
 * this panel names must be one the assistant can actually perform."* Written
 * after a journey witness asked Olumi, in natural language, twice, to do what a
 * disclosure told them to do and was declined both times — then applied to that
 * surface and nowhere else.
 *
 * ── WHAT IS ASSERTED, AND WHY IT IS NOT A STRING PIN ───────────────────────
 * The copy may be reworded. What may not happen is either branch naming an act
 * its reader cannot perform, so every positive assertion has an
 * opposite-direction twin: the settable branch must NAME a range, the
 * unsettable branch must not name one ANYWHERE in the card — title, signal,
 * whyNow, tryThis, or the button.
 *
 * ⚠ `NO_RANGE_NOTICE`'s own spec bans the literals `add a range` and `set a
 * range` for the same reason, on the Model tab. This is the same ban, on the
 * surface that was still emitting one of them.
 */
import { describe, it, expect } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import { rangeIsSettableForCategory } from '../factorRangeCapability'
import type { StrengthenInputs, StrengthenFactor } from '../strengthenTypes'

const LABEL = 'Pitch Quality'

/** The gate is `show && value < 0.4 && influence > 0.5` — this clears it. */
const lowEvidenceHighInfluence = (
  rangeIsSettable: boolean | undefined,
): StrengthenFactor => ({
  factorId: 'node_pitch',
  label: LABEL,
  influence: 0.9,
  confidenceDisplay: { show: true, value: 0.2, isDefaulted: false, isProvisional: false },
  // ⚠ REQUIRED on `StrengthenFactor`, and omitting it was a real TS error the
  // `Typecheck Gate Self-Test` caught — `tsconfig.app.json` EXCLUDES tests, so
  // the ordinary `pnpm typecheck` is blind to spec files and this is the gate
  // that is not. Its value is irrelevant to every assertion here; its presence
  // is not optional.
  canFocus: true,
  ...(rangeIsSettable === undefined ? {} : { rangeIsSettable }),
})

const inputsWith = (rangeIsSettable: boolean | undefined): StrengthenInputs =>
  ({
    goalThreshold: 62,
    analysisComplete: true,
    flipThresholds: null,
    fragileEdges: [],
    factors: [lowEvidenceHighInfluence(rangeIsSettable)],
    robustness: { status: null, level: null },
    biasFindingTypes: [],
    phase3Items: [],
  }) as unknown as StrengthenInputs

const lehi = (rangeIsSettable: boolean | undefined) =>
  buildRecommendations(inputsWith(rangeIsSettable)).find((r) =>
    r.id.startsWith('strengthen:lehi:'),
  )

/** Everything a reader can see on the card, as one string. */
const allCardText = (r: ReturnType<typeof lehi>): string =>
  [r?.title, r?.signal, r?.whyNow, r?.tryThis, r?.action.label].filter(Boolean).join(' ').toLowerCase()

describe('the capability predicate', () => {
  it('is true for external and false for everything else', () => {
    expect(rangeIsSettableForCategory('external')).toBe(true)
    // ⛔ THE CONTRAST ROWS. Without them a predicate returning `true` always
    // would satisfy the line above and the whole file would be blind.
    for (const other of ['controllable', 'observable', '', null, undefined, 'External', 0]) {
      expect(rangeIsSettableForCategory(other), `category ${String(other)}`).toBe(false)
    }
  })
})

describe('the LEHI card names a range only where one can be set', () => {
  /**
   * ⚠ PRECONDITION. Every assertion below reads the card. If the trigger ever
   * stopped firing they would all pass on `undefined` — the vacuity that makes
   * a guard worthless — and the failure would name the wrong thing.
   */
  it('PRECONDITION: the fixture raises the card on BOTH branches', () => {
    expect(lehi(true), 'settable branch produced no card').toBeDefined()
    expect(lehi(false), 'unsettable branch produced no card').toBeDefined()
  })

  it('SETTABLE: names the range, and the button says what pressing it does', () => {
    const r = lehi(true)
    expect(allCardText(r)).toContain('range')
    expect(r?.action.kind).toBe('canvas-focus')
    // The route moves the camera, so the label must be a LOCATING verb.
    expect(r?.action.label).toMatch(/^(show|see|view|find|open|go|take|reveal)\b/i)
  })

  /**
   * ⛔ THE OPPOSITE-DIRECTION TWIN, and the one the defect lived in. Not just
   * "the button changed" — the word must be gone from EVERY channel the reader
   * meets, because the title was making the promise the button only repeated.
   */
  it('NOT SETTABLE: no range is named anywhere on the card', () => {
    const text = allCardText(lehi(false))
    expect(text).not.toContain('range')
    for (const banned of ['set a range', 'add a range', 'give it a range']) {
      expect(text, `banned promise: ${banned}`).not.toContain(banned)
    }
  })

  it('NOT SETTABLE: the act offered is one the assistant can actually perform', () => {
    const r = lehi(false)
    expect(r?.action.kind).toBe('ai-dialogue')
    expect((r?.action.prompt ?? '').length, 'an ai-dialogue with no prompt sends the title').toBeGreaterThan(20)
    expect(r?.action.prompt).toContain(LABEL)
  })

  /**
   * ⛔ FAIL-CLOSED. A caller that supplies no capability — the prototype route,
   * a legacy one — must get the branch that promises nothing. A wrongly-named
   * act spends the trust the finding just earned; an unnamed one costs only
   * wording.
   */
  it('ABSENT is read as NO, not as yes', () => {
    expect(allCardText(lehi(undefined))).not.toContain('range')
    expect(lehi(undefined)?.action.kind).toBe('ai-dialogue')
  })

  /**
   * ⭐ THE FINDING SURVIVES BOTH BRANCHES. The easy wrong fix is to drop the
   * card when no act exists — which hides something true. "High influence, low
   * evidence" is worth telling a reader whatever they can do about it.
   */
  it('keeps the finding on both branches — only the ACT moves', () => {
    for (const settable of [true, false]) {
      const r = lehi(settable)
      expect(r?.signal, `signal on settable=${settable}`).toBe('High influence, low evidence.')
      expect(r?.title, `title names the factor on settable=${settable}`).toContain(LABEL)
      expect(r?.sourceLine, `sourceLine on settable=${settable}`).toBeTruthy()
    }
  })

  /**
   * ⛔ CONTRAST CONTROL FOR THE WHOLE FILE. If the branch were ignored, every
   * assertion above that happens to hold on one branch could hold on both. This
   * proves the flag discriminates.
   */
  it('PRECONDITION: the two branches genuinely differ', () => {
    expect(allCardText(lehi(true))).not.toBe(allCardText(lehi(false)))
    expect(lehi(true)?.action.kind).not.toBe(lehi(false)?.action.kind)
  })
})
