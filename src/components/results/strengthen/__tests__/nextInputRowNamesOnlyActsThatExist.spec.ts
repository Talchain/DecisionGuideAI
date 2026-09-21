/**
 * ⭐⭐ THE `next-input` CARD MAY NAME A RANGE ONLY WHERE ONE CAN BE SET — the
 * SAME ruling `theRangeActExistsOrIsNotNamed.spec.ts` applies to the LEHI card,
 * on the card sitting directly above it in the same list, built by the same
 * function, which that guard never swept.
 *
 * ── THE DEFECT, DERIVED AT THE BYTES ───────────────────────────────────────
 * `buildRecommendations` emits `strengthen:next-input:` with
 *
 *     tryThis: next.declaresNoRange
 *       ? '… Worth settling the range at the same time.'
 *       : 'Use the figure you would defend in the room, not a cautious one.'
 *
 * The branch is on `declaresNoRange` — *does this factor record a range?* — and
 * never on `rangeIsSettable` — *can a range be set for it at all?* Those are
 * two different questions (CLAUDE.md trap 21), and the second one is the only
 * one that decides whether the named act exists.
 *
 * `factorRangeCapability.ts` exists precisely because *"a coaching card was
 * answering yes for every factor and it is true for roughly one in seven"*: a
 * range editor lives on exactly one surface, the canvas inspector's
 * `FactorExternalPanel`, and only for `category === 'external'`. So on roughly
 * six factors in seven this card told the reader to settle a range that cannot
 * be settled anywhere in the product.
 *
 * ── WHY THE EXISTING GUARD DID NOT SEE IT ──────────────────────────────────
 * `theRangeActExistsOrIsNotNamed.spec.ts` selects its card with
 * `r.id.startsWith('strengthen:lehi:')`. A HAND-SCOPED selector, so the ruling
 * was honoured exactly where a guard could observe it and nowhere else — the
 * shape `buildRecommendations.ts` records about the em-dash sweep in its own
 * docblock, four lines from the defect.
 *
 * ── WHAT IS ASSERTED ───────────────────────────────────────────────────────
 * Not a string pin: the copy may be reworded. What may not happen is this card
 * naming an act its reader cannot perform. Every positive assertion has an
 * opposite-direction twin, and the FINDING must survive every branch — only the
 * ACT moves.
 */
import { describe, it, expect } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs, StrengthenFactor } from '../strengthenTypes'

const LABEL = 'Vendor Solution Adoption'
const TOP = 'node_vendor'
const RUNNER = 'node_runner'

/**
 * Rank 1 is clear of its runner-up so `determinedRankDepth` publishes an
 * ordinal, and the runner-up keeps `confidenceDisplay.show` false so the LEHI
 * card cannot fire and pollute the card under test.
 */
const factor = (
  id: string,
  label: string,
  influence: number,
  extra: Partial<StrengthenFactor> = {},
): StrengthenFactor =>
  ({
    factorId: id,
    label,
    influence,
    confidenceDisplay: { show: false, value: 0.9, isDefaulted: false, isProvisional: false },
    canFocus: true,
    ...extra,
  }) as StrengthenFactor

const inputsWith = (
  declaresNoRange: boolean,
  rangeIsSettable: boolean | undefined,
): StrengthenInputs =>
  ({
    goalThreshold: 62,
    analysisComplete: true,
    analysisIdentityIsCurrent: true,
    materialParametersAwaitingUserIds: [TOP],
    flipThresholds: null,
    fragileEdges: [],
    factors: [
      factor(TOP, LABEL, 0.9, {
        declaresNoRange,
        ...(rangeIsSettable === undefined ? {} : { rangeIsSettable }),
      }),
      factor(RUNNER, 'Platform Migration Competing Demand', 0.1),
    ],
    robustness: { status: null, level: null },
    biasFindingTypes: [],
    phase3Items: [],
  }) as unknown as StrengthenInputs

const nextInput = (declaresNoRange: boolean, rangeIsSettable: boolean | undefined) =>
  buildRecommendations(inputsWith(declaresNoRange, rangeIsSettable)).find((r) =>
    r.id.startsWith('strengthen:next-input:'),
  )

/** Everything a reader can see on the card, as one string. */
const allCardText = (r: ReturnType<typeof nextInput>): string =>
  [r?.title, r?.signal, r?.whyNow, r?.tryThis, r?.action.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

describe('the next-input card names a range only where one can be set', () => {
  /**
   * ⚠ PRECONDITION, PINNED IN-TEST. Every assertion below reads the card. If the
   * trigger stopped firing they would all pass on `undefined` — the vacuity that
   * makes a guard worthless — and the failure would name the wrong thing.
   */
  it('PRECONDITION: the fixture raises the card on every branch under test', () => {
    for (const settable of [true, false, undefined]) {
      expect(nextInput(true, settable), `no-range card, settable=${String(settable)}`).toBeDefined()
    }
    expect(nextInput(false, false), 'range-declared card').toBeDefined()
  })

  it('PRECONDITION: the card under test is the next-input card, not the LEHI card', () => {
    const ids = buildRecommendations(inputsWith(true, false)).map((r) => r.id)
    expect(ids.some((id) => id.startsWith('strengthen:next-input:'))).toBe(true)
    expect(ids.some((id) => id.startsWith('strengthen:lehi:'))).toBe(false)
  })

  it('SETTABLE: a factor that records no range, where one CAN be set, may name it', () => {
    expect(allCardText(nextInput(true, true))).toContain('range')
  })

  /**
   * ⛔ THE OPPOSITE-DIRECTION TWIN, and the one the defect lives in. The word
   * must be gone from EVERY channel the reader meets — title, signal, whyNow,
   * tryThis and the button — not merely from the one the fix happened to touch.
   */
  it('NOT SETTABLE: no range is named anywhere on the card', () => {
    const text = allCardText(nextInput(true, false))
    expect(text).not.toContain('range')
    for (const banned of ['set a range', 'add a range', 'settling the range']) {
      expect(text, `banned promise: ${banned}`).not.toContain(banned)
    }
  })

  /**
   * ⛔ FAIL-CLOSED, matching `StrengthenFactor.rangeIsSettable`'s own documented
   * rule: absent means UNKNOWN and is read as NO.
   */
  it('ABSENT is read as NO, not as yes', () => {
    expect(allCardText(nextInput(true, undefined))).not.toContain('range')
  })

  /**
   * ⭐ THE FINDING SURVIVES EVERY BRANCH. The easy wrong fix is to drop the card
   * where no act exists, which hides something true: this is still the input the
   * run turns on most, and the estimate behind it is still Olumi's.
   */
  it('keeps the finding on every branch — only the ACT moves', () => {
    for (const settable of [true, false, undefined]) {
      const r = nextInput(true, settable)
      expect(r?.title, `title names the factor, settable=${String(settable)}`).toContain(LABEL)
      expect(r?.signal, `signal, settable=${String(settable)}`).toContain("Olumi's")
      expect(r?.sourceLine, `sourceLine, settable=${String(settable)}`).toBeTruthy()
      expect(r?.targetId, `targetId, settable=${String(settable)}`).toBe(TOP)
      expect(r?.action.kind, `route, settable=${String(settable)}`).toBe('canvas-focus')
    }
  })

  /**
   * ⛔ CONTRAST CONTROL FOR THE WHOLE FILE. If the capability branch were
   * ignored, every assertion above that holds on one branch could hold on both.
   * This proves the flag discriminates — and it is the assertion that REDs at
   * pristine, where the two branches are byte-identical.
   */
  it('PRECONDITION: the capability flag genuinely discriminates', () => {
    expect(allCardText(nextInput(true, true))).not.toBe(allCardText(nextInput(true, false)))
  })

  /**
   * ⭐ AND THE CAPABILITY MUST NOT LEAK INTO THE BRANCH IT DOES NOT DECIDE. A
   * factor that DOES record a range says the same thing either way; reading the
   * capability there would be a second question answered by the wrong flag.
   */
  it('a factor that records a range is unaffected by the capability', () => {
    expect(allCardText(nextInput(false, true))).toBe(allCardText(nextInput(false, false)))
  })
})
