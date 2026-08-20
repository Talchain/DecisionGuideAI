/**
 * `analysis_ready.may_run` — the Run chip must render on the turn that offers it.
 *
 * ## THE DEFECT
 *
 * The readiness answer loop's payoff turn says *"that's enough to run — two
 * options have effects set, I'll leave the others out and say so"*. At exactly
 * that turn CEE's `analysis_ready.status` is `needs_user_input` (the model is not
 * ready AS IT STANDS) while the run path WILL admit it (it proceeds by excluding
 * the open options). The chip gate read only `status === 'ready'`, so the
 * affordance the turn had just promised was filtered out of the chip row.
 *
 * Measured in CEE on the `live-4day-week` capture: ONE status value
 * (`needs_user_input`) carries BOTH admission verdicts, depending on how many
 * options are unconfigured. No reading of `status` can recover the answer —
 * which is why the producer now publishes its own verdict as `may_run`.
 *
 * ## THE GATE IS A DISJUNCTION, AND THAT IS DELIBERATE
 *
 *     admitted = status === 'ready' || may_run === true
 *
 * A strict WIDENING. Every chip that renders today still renders: the old term
 * is untouched and the new term can only ever add. An older CEE that sends no
 * `may_run` is byte-for-byte today's behaviour, so the two services may deploy
 * in either order. `=== true` is strict, so a malformed or unexpected value can
 * never widen the gate by accident.
 *
 * ## OPPOSITE DIRECTION, ASSERTED IN THE SAME RUN
 *
 * A model that must NOT run must still not offer the chip. `may_run: false` and
 * absent-`may_run` are both pinned below; without them this spec would certify a
 * gate that had simply been thrown open.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import { useCanvasStore } from '../../store'
import type { ActionChip } from '../types'

function makeChip(overrides: Partial<ActionChip> = {}): ActionChip {
  return {
    id: overrides.id ?? 'chip_1',
    label: 'Run analysis',
    intent: 'primary',
    message: 'Please run the analysis now',
    ...overrides,
  }
}

/** Seed the slice exactly as the wire delivers it, including an absent `may_run`. */
function setReadiness(status: string | null, mayRun?: boolean) {
  const payload = status
    ? {
        goal_node_id: 'goal_1',
        status,
        options: [{ id: 'opt_1', label: 'A', status: 'ready', interventions: {} }],
        ...(mayRun === undefined ? {} : { may_run: mayRun }),
      }
    : null
  useCanvasStore.setState({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ceeAnalysisReady: payload as any,
  })
}

function renderRunChip() {
  render(<SuggestedChips chips={[makeChip({ action_type: 'run_analysis' })]} onChipClick={vi.fn()} />)
  return screen.queryByTestId('suggested-chip-chip_1')
}

describe('SuggestedChips — may_run gate', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setReadiness(null)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    setReadiness(null)
  })

  it('THE PAYOFF TURN — renders run_analysis when status is needs_user_input but may_run is true', () => {
    // Precondition stated in the fixture itself: the status is one the OLD gate
    // rejects, so a pass here is provably the new term's doing.
    setReadiness('needs_user_input', true)
    expect(renderRunChip()).toBeInTheDocument()
  })

  it('OPPOSITE DIRECTION — a model that must NOT run keeps the chip hidden (may_run false)', () => {
    setReadiness('needs_user_input', false)
    expect(renderRunChip()).toBeNull()
  })

  it('FALLBACK — an older CEE that sends no may_run keeps today behaviour exactly (unready → hidden)', () => {
    setReadiness('needs_user_input')
    expect(renderRunChip()).toBeNull()
  })

  it('FALLBACK — an older CEE that sends no may_run keeps today behaviour exactly (ready → shown)', () => {
    setReadiness('ready')
    expect(renderRunChip()).toBeInTheDocument()
  })

  it('WIDENING, NEVER NARROWING — a strictly-ready model still renders whatever may_run says', () => {
    // CEE proves `status === 'ready'` implies `may_run === true`, so the second
    // arm is unreachable in production. It is pinned anyway: if that invariant
    // ever broke, this gate must still not REMOVE a chip that renders today.
    setReadiness('ready', true)
    expect(renderRunChip()).toBeInTheDocument()
    cleanup()
    setReadiness('ready', false)
    expect(renderRunChip()).toBeInTheDocument()
  })

  it('a non-boolean may_run never widens the gate — strict === true', () => {
    // Guards against a rogue/legacy producer stringifying the field.
    setReadiness('needs_user_input', 'true' as unknown as boolean)
    expect(renderRunChip()).toBeNull()
  })

  it('may_run does not resurrect a chip when the whole slice is missing', () => {
    setReadiness(null)
    expect(renderRunChip()).toBeNull()
  })
})
