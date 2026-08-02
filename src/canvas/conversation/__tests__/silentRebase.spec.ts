/**
 * ROADMAP 2.312 — the pure half: can we PROVE the engine rebased this edit?
 *
 * THE MEASURED DEFECT (`PHASE0-EVIDENCE-2026-07-28/probe-560-confirm-as-is-receipt.md`
 * §6, deployed guest build, live-observed). The canvas restores
 * `localStorage['olumi-canvas-autosave']` on boot and fetches no graph — the
 * complete boot request manifest is 7 requests, none of which is the scenario
 * graph. So the tab showed `Monthly Observability Spend · From brief · £4,000`
 * while the engine held a different number. The operator typed £4,200 and CEE
 * recorded:
 *
 *   "Updated Monthly Observability Spend from £3,500 to £4,200"
 *
 * — a before-value the operator was never shown, on a base they never chose.
 * The canonical graph was edited against a base that existed nowhere on screen,
 * and nothing said so.
 *
 * WHY THE ASSERTIONS ARE MOSTLY CONTROLS. The RED direction is one line — a
 * mismatch must be reported. The whole difficulty is the other direction: a
 * detector that cried "rebase" whenever it was unsure would fire on ordinary
 * edits, and a warning about the user's own data that is usually wrong is worse
 * than no warning at all (CLAUDE.md trap 7b — the standing-red that taught every
 * lane to stop looking). So every case where the answer is NOT PROVABLE is
 * pinned to null here, and each of those controls also blocks a cheaper wrong
 * fix: `always warn`, `warn whenever a receipt exists`, `warn on any numeric
 * difference regardless of scale or unit`.
 */

import { describe, it, expect } from 'vitest'
import {
  captureOptimisticFactorEdit,
  describeRebaseDivergence,
  detectSilentRebase,
  readReceiptBaseline,
  type RebaseDivergence,
} from '../optimisticFactorEdit'

const TARGET = 'fac_monthly_cost'

/**
 * What the STALE canvas was showing — lifted from the probe's own capture of
 * `localStorage['olumi-canvas-autosave']` at the moment of the edit.
 */
const SHOWN_ON_SCREEN = {
  value: 0.8,
  raw_value: 4000,
  unit: '£',
  cap: 5000,
  source: 'brief_extraction',
}

/** The base the ENGINE actually held — visible only in its own receipt. */
const SERVER_HELD = { value: 0.7, raw_value: 3500, unit: '£', cap: 5000 }

/** An applied `graph_patch` receipt, block-level `target_id` shape. */
const receipt = (before: unknown, targetId = TARGET) => ({
  assistant_text: 'Updated Monthly Observability Spend from £3,500 to £4,200.',
  blocks: [
    {
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: targetId,
      before,
      after: { value: 0.84, raw_value: 4200, unit: '£', cap: 5000 },
    },
  ],
  graph_hash: 'c41b7a02e9d3f815',
})

/** The snapshot the panel captures BEFORE its optimistic write. */
const editFrom = (observed: unknown) =>
  captureOptimisticFactorEdit(TARGET, 0.84, { observedState: observed })!

// ---------------------------------------------------------------------------
// RED — the measured defect, in both receipt shapes
// ---------------------------------------------------------------------------

describe('detectSilentRebase — the rebase the probe measured', () => {
  it('reports the £4,000-on-screen / £3,500-on-server divergence', () => {
    const d = detectSilentRebase(editFrom(SHOWN_ON_SCREEN), receipt(SERVER_HELD))
    expect(d).toEqual<RebaseDivergence>({
      nodeId: TARGET,
      shownBase: 4000,
      serverBase: 3500,
      basis: 'raw_value',
      unit: '£',
    })
  })

  it('reads the operations[] receipt shape too — both exist in the contract', () => {
    const response = {
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operations: [{ target_id: TARGET, before: SERVER_HELD }],
        },
      ],
    }
    expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), response)?.serverBase).toBe(3500)
  })

  it('falls back to model scale when NEITHER side states a raw magnitude', () => {
    const d = detectSilentRebase(editFrom({ value: 0.8 }), receipt({ value: 0.7 }))
    expect(d).toMatchObject({ basis: 'value', shownBase: 0.8, serverBase: 0.7 })
  })

  it('unwraps the {value:n} wrapper CEE and legacy paths both emit', () => {
    const d = detectSilentRebase(
      editFrom({ raw_value: { value: 4000 }, unit: '£' }),
      receipt({ raw_value: { value: 3500 }, unit: '£' }),
    )
    expect(d).toMatchObject({ shownBase: 4000, serverBase: 3500 })
  })
})

// ---------------------------------------------------------------------------
// CONTROLS — every case where a rebase is NOT PROVABLE reports nothing
// ---------------------------------------------------------------------------

describe('detectSilentRebase — reports nothing unless it can prove it', () => {
  it('the ordinary edit — canvas in step with the engine — is silent', () => {
    // Blocks the cheapest wrong fix: a detector that always warns passes every
    // RED assertion above and fires on every edit anyone ever makes.
    expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), receipt(SHOWN_ON_SCREEN))).toBeNull()
  })

  it('a float artefact is not a rebase', () => {
    const d = detectSilentRebase(
      editFrom({ value: 0.1 + 0.2 }),
      receipt({ value: 0.30000000000000004 }),
    )
    expect(d).toBeNull()
  })

  it('CEE’s REFUSAL (blocks: []) proves nothing about the base', () => {
    expect(
      detectSilentRebase(editFrom(SHOWN_ON_SCREEN), {
        assistant_text: "That exceeds the cap. I haven't changed anything.",
        blocks: [],
      }),
    ).toBeNull()
  })

  it('a receipt for a DIFFERENT factor does not speak for mine', () => {
    expect(
      detectSilentRebase(editFrom(SHOWN_ON_SCREEN), receipt(SERVER_HELD, 'fac_other')),
    ).toBeNull()
  })

  it('an UNATTRIBUTABLE patch does not speak for mine either', () => {
    // Deliberately stricter than `responseAppliedFactorEdit`, which counts an
    // untargeted patch as ours. That direction is safe for "don't revert an
    // accepted value"; it is NOT safe for accusing a base of being wrong.
    const response = { blocks: [{ type: 'graph_patch', status: 'applied', before: SERVER_HELD }] }
    expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), response)).toBeNull()
  })

  it('a receipt carrying no `before` proves nothing', () => {
    const response = {
      blocks: [{ type: 'graph_patch', status: 'applied', target_id: TARGET }],
    }
    expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), response)).toBeNull()
  })

  it('a NON-applied patch is not evidence of the applied base', () => {
    for (const status of ['rejected', 'proposed', 'dismissed', 'failed', 'error', 'pending']) {
      const response = {
        blocks: [{ type: 'graph_patch', status, target_id: TARGET, before: SERVER_HELD }],
      }
      expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), response), status).toBeNull()
    }
  })

  it('DIFFERENT UNITS are a units bug, not a rebase', () => {
    const d = detectSilentRebase(
      editFrom({ raw_value: 3500, unit: 'months' }),
      receipt({ raw_value: 4000, unit: '£' }),
    )
    expect(d).toBeNull()
  })

  it('a raw magnitude on ONE side only is not comparable', () => {
    // £4,000 against a model-scale 0.7 is not a divergence of 3999.3 — the two
    // numbers are not on the same scale, and reporting it would be a fabricated
    // magnitude in a message about the user's money.
    expect(detectSilentRebase(editFrom({ raw_value: 4000 }), receipt({ value: 0.7 }))).toBeNull()
    expect(detectSilentRebase(editFrom({ value: 0.8 }), receipt({ raw_value: 3500 }))).toBeNull()
  })

  it('a snapshot with no observed state at all reports nothing', () => {
    expect(detectSilentRebase(editFrom(undefined), receipt(SERVER_HELD))).toBeNull()
  })

  it('a malformed response reports nothing rather than throwing', () => {
    for (const bad of [null, undefined, {}, { blocks: null }, { blocks: 'nope' }, 42]) {
      expect(() => detectSilentRebase(editFrom(SHOWN_ON_SCREEN), bad)).not.toThrow()
      expect(detectSilentRebase(editFrom(SHOWN_ON_SCREEN), bad)).toBeNull()
    }
  })
})

describe('readReceiptBaseline', () => {
  it('returns the before snapshot verbatim', () => {
    expect(readReceiptBaseline(receipt(SERVER_HELD), TARGET)).toEqual(SERVER_HELD)
  })

  it('returns null for an empty target id rather than guessing', () => {
    expect(readReceiptBaseline(receipt(SERVER_HELD), '')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// THE SENTENCE — what the operator is actually told
// ---------------------------------------------------------------------------

describe('describeRebaseDivergence', () => {
  const divergence: RebaseDivergence = {
    nodeId: TARGET,
    shownBase: 4000,
    serverBase: 3500,
    basis: 'raw_value',
    unit: '£',
  }

  it('names the factor, what was shown, and what the engine held', () => {
    const msg = describeRebaseDivergence(divergence, 'Monthly Observability Spend')
    expect(msg).toContain('Monthly Observability Spend')
    expect(msg).toContain('£4,000')
    expect(msg).toContain('£3,500')
  })

  it('says the change was applied on top of the ENGINE’s base, not the shown one', () => {
    const msg = describeRebaseDivergence(divergence, 'Spend')
    expect(msg).toContain('on top of £3,500')
    expect(msg).toContain('not the £4,000 shown on your canvas')
  })

  it('warns that other values may also differ from the model', () => {
    // Nothing scopes a divergence to the one factor that happened to be edited.
    expect(describeRebaseDivergence(divergence, 'Spend')).toContain(
      'may also differ from the model',
    )
  })

  it('makes NO claim about which side is out of date', () => {
    // The receipt proves the two bases DIFFER. It does not prove a direction,
    // and the canvas-ahead case below produces identical evidence. An earlier
    // draft opened with "Your canvas was out of date" and would have reported
    // a canvas that was AHEAD of the engine as one that was behind.
    const msg = describeRebaseDivergence(divergence, 'Spend').toLowerCase()
    for (const causal of ['out of date', 'stale', 'behind', 'outdated', 'older']) {
      expect(msg, `must not diagnose "${causal}"`).not.toContain(causal)
    }
  })

  it('reads the same when the CANVAS is the side that moved', () => {
    // Same sentence, no accusation either way — the operator is told which
    // number the change landed on, which is all the receipt witnesses.
    const canvasAhead: RebaseDivergence = {
      nodeId: TARGET,
      shownBase: 0.6,
      serverBase: 0.4,
      basis: 'value',
    }
    const msg = describeRebaseDivergence(canvasAhead, 'Team morale')
    expect(msg).toContain('on top of 0.4')
    expect(msg).toContain('not the 0.6 shown on your canvas')
  })

  it('offers no remedy that does not work', () => {
    // Reloading is the obvious closing line and it is FALSE: the boot path
    // restores localStorage and fetches no graph (the defect this guard exists
    // under). Asking in chat genuinely works — CEE answers from its own graph.
    const msg = describeRebaseDivergence(divergence, 'Spend').toLowerCase()
    expect(msg).not.toContain('reload')
    expect(msg).not.toContain('refresh')
    expect(msg).toContain('ask me')
  })

  it('renders model-scale numbers as numbers, never as a qualitative word', () => {
    // `formatValueWithUnit` maps an unitless 0–1 value to "moderate"/"high".
    // That is right on a chip and wrong in a sentence whose entire job is to
    // state two specific numbers.
    const msg = describeRebaseDivergence(
      { nodeId: TARGET, shownBase: 0.8, serverBase: 0.7, basis: 'value' },
      'Spend',
    )
    expect(msg).toContain('0.8')
    expect(msg).toContain('0.7')
    expect(msg).not.toMatch(/moderate|very high|\bhigh\b/)
  })

  // -------------------------------------------------------------------------
  // The RAW basis is NOT self-protecting — this is where the sentence refuted
  // itself. `formatValueWithUnit` keys its qualitative branch on the UNIT and
  // the 0–1 bound, never on the basis, so a raw magnitude in 0–1 with no real
  // unit rendered as a word: "it showed Team morale as low, but the model held
  // low". Reachable because an UNCAPPED factor stores the same number in
  // `value` and `raw_value` (CEE `normalise-factor-value.ts:12-16`, `:138-141`)
  // and `snapshotObservedState` copies it into `before` verbatim.
  // -------------------------------------------------------------------------
  it.each([
    ['no unit at all', undefined],
    ['an empty unit', ''],
    ['the placeholder unit "scale"', 'scale'],
    ['the placeholder unit "score"', 'score'],
    ['the placeholder unit "index"', 'index'],
  ])('states RAW-basis 0–1 magnitudes as numbers with %s', (_label, unit) => {
    const msg = describeRebaseDivergence(
      {
        nodeId: TARGET,
        shownBase: 0.6,
        serverBase: 0.4,
        basis: 'raw_value',
        ...(unit === undefined ? {} : { unit }),
      },
      'Team morale',
    )
    expect(msg).toContain('0.6')
    expect(msg).toContain('0.4')
    expect(msg).not.toMatch(/\b(very low|low|moderate|high|very high)\b/)
    // The self-refuting shape, pinned directly: the two magnitudes must never
    // render to the SAME string in a sentence that exists to contrast them.
    expect(msg).not.toMatch(/on top of (\S+), not the \1 shown/)
  })

  it('still wears a REAL unit on the raw basis', () => {
    // The guard must not have been bought by dropping units everywhere.
    const msg = describeRebaseDivergence(
      { nodeId: TARGET, shownBase: 4000, serverBase: 3500, basis: 'raw_value', unit: '£' },
      'Spend',
    )
    expect(msg).toContain('£4,000')
    expect(msg).toContain('£3,500')
  })

  it('does not attach a unit to a model-scale magnitude', () => {
    // `unit` is carried on the divergence even when the comparison fell back to
    // model scale; printing "£0.8" would be a fabricated magnitude.
    const msg = describeRebaseDivergence(
      { nodeId: TARGET, shownBase: 0.8, serverBase: 0.7, basis: 'value', unit: '£' },
      'Spend',
    )
    expect(msg).not.toContain('£')
  })
})
