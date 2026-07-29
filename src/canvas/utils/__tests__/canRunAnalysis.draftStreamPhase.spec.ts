/**
 * The streamed-draft honesty rung on the run gate (ROADMAP 2.122).
 *
 * Exhaustive over `DraftStreamPhase`, deliberately: the rung was ORIGINALLY a
 * boolean the caller derived, and a mutation that dropped `'unsettled'` from
 * that derivation survived the mutation battery because no test drove the
 * caller's copy. The phase now reaches the gate raw, and this spec enumerates
 * every phase so a clause cannot be dropped in silence.
 */
import { describe, it, expect } from 'vitest'

import { canRunAnalysis, DRAFT_VALUES_SETTLING_REFUSAL } from '../canRunAnalysis'
import type { DraftStreamPhase } from '../../stores/draftStore'

/** A graph that would otherwise pass the gate's structural rungs. */
const OPEN_GATE_INPUTS = {
  graphHealth: null,
  readiness: null,
  hasBlockers: false,
  nodeCount: 5,
} as const

const ALL_PHASES: readonly DraftStreamPhase[] = ['idle', 'drafting', 'settling', 'unsettled']
const MUST_BLOCK: readonly DraftStreamPhase[] = ['settling', 'unsettled']

describe('canRunAnalysis — draftStreamPhase rung, exhaustive', () => {
  it.each(MUST_BLOCK)('BLOCKS on phase "%s", with the honest reason', (phase) => {
    const r = canRunAnalysis({ ...OPEN_GATE_INPUTS, draftStreamPhase: phase })
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe(DRAFT_VALUES_SETTLING_REFUSAL)
  })

  it.each(ALL_PHASES.filter((p) => !MUST_BLOCK.includes(p)))(
    'does NOT block on phase "%s" — the rung is not a blanket refusal',
    (phase) => {
      const r = canRunAnalysis({ ...OPEN_GATE_INPUTS, draftStreamPhase: phase })
      expect(r.reason).not.toBe(DRAFT_VALUES_SETTLING_REFUSAL)
    },
  )

  it('defaults to not-blocking when the phase is omitted (every other caller)', () => {
    expect(canRunAnalysis(OPEN_GATE_INPUTS).reason).not.toBe(DRAFT_VALUES_SETTLING_REFUSAL)
  })

  it('enumerates the WHOLE phase union — a new phase must be classified here', () => {
    // Derived from the type via an exhaustive switch: adding a phase to
    // DraftStreamPhase without adding it below is a compile error, so this list
    // cannot silently go stale (trap 12).
    const classify = (p: DraftStreamPhase): 'block' | 'allow' => {
      switch (p) {
        case 'settling':
        case 'unsettled':
          return 'block'
        case 'idle':
        case 'drafting':
          return 'allow'
      }
    }
    for (const p of ALL_PHASES) {
      const blocked = canRunAnalysis({ ...OPEN_GATE_INPUTS, draftStreamPhase: p }).reason ===
        DRAFT_VALUES_SETTLING_REFUSAL
      expect(blocked).toBe(classify(p) === 'block')
    }
  })
})
