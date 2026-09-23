/**
 * ⭐ RULE 5(c) — THE RUN GATE READS THE ONE-WRITER LATCH (programme-docs #63
 * 5795173355 / 5795221415 / 5799075452).
 *
 * OW-1 made "CEE holds this scenario's model" a STORED fact
 * (`ceeHeldScenarioIds`, read through `ceeHoldsModel`). Until this change the
 * Run gate still released a ready-made model only on the digest-keyed
 * acknowledgement, and OW-1 removed the re-offer that used to earn one. That
 * left two permanent Run walls on starter/template models, both pinned on
 * Canvas's branch:
 *
 *   Wall 1 — a reload where the boot read returns CEE's graph but cannot vouch
 *            for every canvas value, so the digest never matches again.
 *   Wall 2 — a rename answered by an untyped 500, then applied renames: the
 *            acknowledgement cannot be extended, so the digest never matches.
 *
 * In both, CEE HOLDS the model (the latch is set) and nothing of the user's is
 * still being settled, yet Run says "held on a saved example. Re-draft it live",
 * which is false and whose remedy would replace the model CEE holds.
 *
 * THE RULE: on a latched scenario the saved-example hold is over. Only the
 * user's own change that is still on its way, or still unconfirmed, holds Run,
 * and it says so in `heldReason`'s sentence for that cause (never "re-draft").
 * The latch is per SCENARIO: another scenario's latch releases nothing here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import {
  ANALYSIS_HELD_NOTICE,
  analysisHeldOn,
  heldReason,
  isUserEditHold,
} from '../analysisHeldOnInjectedModel'
import { canRunAnalysis, getRunButtonTooltip } from '../canRunAnalysis'
import { useCanvasStore } from '../../store'
import {
  __resetCeeHeldModelLatchForTest,
  latchCeeHeldModel,
} from '../../registration/ceeHeldModel'
import { useAnalysisHoldReason } from '../../hooks/useAnalysisHold'
import {
  CAUSE_MUST_NAME,
  HOLD_CAUSES,
  SCENARIO,
  TEMPLATE_STAMP,
  acknowledgeCurrentGraph,
  arrangeHoldCause,
  resetEditHoldRegisters,
  seedHeldCanvas,
} from '../../registration/__tests__/helpers/editHoldCauses'

const REDRAFT = /re-?draft/i
const OTHER_SCENARIO = 'scn-some-other-decision'

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

const state = () => useCanvasStore.getState() as never

/** The run gate's tooltip, fed exactly as both call sites feed it. */
function gateTooltip(): string | undefined {
  const gate = canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: useCanvasStore.getState().nodes.length,
    analysisHeldOn: heldReason(state()),
  } as never)
  return getRunButtonTooltip(gate)
}

beforeEach(() => {
  seedCanonicalRunPath()
  resetEditHoldRegisters()
  __resetCeeHeldModelLatchForTest()
  // A starter whose digest was NEVER acknowledged: the wall's shape. Nothing
  // of the user's is in flight.
  seedHeldCanvas()
})

afterEach(() => {
  resetEditHoldRegisters()
  __resetCeeHeldModelLatchForTest()
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* jsdom quirk */ }
})

describe('PRECONDITION — unlatched, the fixture is the wall', () => {
  it('a stamped starter with no acknowledgement is held on the saved-example sentence', () => {
    expect(analysisHeldOn(state())).toBe('starter')
    expect(heldReason(state())?.sentence).toBe(ANALYSIS_HELD_NOTICE.starter)
  })
})

describe('⭐ CEE holds the model (latched) and nothing of the user is unsettled → Run is released', () => {
  it('starter — Wall 1/2 shape: latched, digest never acknowledged', () => {
    latchCeeHeldModel(SCENARIO, 'boot_read')
    expect(analysisHeldOn(state())).toBeNull()
    expect(heldReason(state())).toBeNull()
    expect(gateTooltip() ?? '').not.toContain('saved example')
    expect(gateTooltip() ?? '').not.toMatch(REDRAFT)
  })

  it('template — the same rule; the stamp is provenance, not analysability', () => {
    seedHeldCanvas({ stamp: TEMPLATE_STAMP })
    expect(analysisHeldOn(state())).toBe('template')
    latchCeeHeldModel(SCENARIO, 'applied_receipt')
    expect(analysisHeldOn(state())).toBeNull()
  })

  it('the Run gate re-reads when the latch lands — the graph does not change', () => {
    const { result } = renderHook(() => useAnalysisHoldReason())
    expect(result.current?.kind).toBe('starter')
    act(() => latchCeeHeldModel(SCENARIO, 'boot_read'))
    expect(result.current).toBeNull()
  })
})

describe('⛔ contrast — the latch is per SCENARIO', () => {
  it("another scenario's latch releases nothing here", () => {
    latchCeeHeldModel(OTHER_SCENARIO, 'registration')
    expect(analysisHeldOn(state())).toBe('starter')
    expect(heldReason(state())?.sentence).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('an unlatched but ACKNOWLEDGED digest still releases (the existing path is kept)', () => {
    acknowledgeCurrentGraph()
    expect(analysisHeldOn(state())).toBeNull()
  })
})

describe("⭐ latched, but the user's own change is unsettled → Run is held, and says which change", () => {
  it.each(HOLD_CAUSES)('%s', (cause) => {
    latchCeeHeldModel(SCENARIO, 'boot_read')
    arrangeHoldCause(cause)
    const reason = heldReason(state())
    expect(reason, `${cause}: Run released while the user's change is unsettled`).not.toBeNull()
    expect(isUserEditHold(reason), `${cause}: banner would offer re-draft`).toBe(true)
    const s = reason!.sentence
    expect(s).not.toMatch(REDRAFT)
    expect(s).not.toContain('saved example')
    for (const needle of CAUSE_MUST_NAME[cause]) {
      if (typeof needle === 'string') expect(s, `${cause}: does not name "${needle}"`).toContain(needle)
      else expect(s, `${cause}: does not say ${needle}`).toMatch(needle)
    }
    expect(gateTooltip()).toBe(s)
  })

  it('an in-flight change holds even when the digest IS acknowledged — fail closed', () => {
    latchCeeHeldModel(SCENARIO, 'registration')
    acknowledgeCurrentGraph()
    arrangeHoldCause('edit_on_the_wire')
    expect(heldReason(state())?.kind).toBe('edit_in_delivery')
  })
})
