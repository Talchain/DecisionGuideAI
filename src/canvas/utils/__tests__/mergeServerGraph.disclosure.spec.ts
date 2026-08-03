/**
 * The DISCLOSURE pin — re-review finding on `eb41fc0f`.
 *
 * A3 added a pulse so a value cannot move under the user in silence. It was
 * pinned by NOTHING: deleting the whole `pulseAppliedTargets` block left all 69
 * specs green (executed by the reviewer). That is the same class as the
 * original A2 wiring finding — machinery that reads as a guarantee and whose
 * removal nothing notices — so revert-must-go-red applies to it too.
 *
 * The disclosure is only meaningful if it lands on the RIGHT elements, so both
 * cases are identity-bound: an unchanged node and an ADDED node must not be
 * pulsed. Pulsing everything would be as dishonest as pulsing nothing — it
 * would announce changes that did not happen and bury the one that did.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { pulseSpy } = vi.hoisted(() => ({ pulseSpy: vi.fn() }))

// The factory REPLACES the module, so it must carry the module's whole export
// surface — a hand-listed subset is the trap 12 mirror that silently drops
// whatever was added since. Derived from the real module and spread over.
vi.mock('../appliedEditPulse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../appliedEditPulse')>()),
  pulseAppliedTargets: pulseSpy,
}))

import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'

const SCENARIO = '11111111-2222-4333-8444-555555555555'

function seed(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 300, y: 400 },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

beforeEach(() => {
  pulseSpy.mockClear()
  seed()
})

describe('mergeServerGraphOnHydrate — the overwrite is DISCLOSED', () => {
  it('pulses ONCE, and only the node whose value the server changed', () => {
    mergeServerGraphOnHydrate({
      nodes: [
        // changed → must be disclosed
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        // unchanged → must NOT be disclosed
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
        // an ADDITION is a new arrival, not an overwrite → must NOT be disclosed
        { id: 'factor-2', kind: 'factor', label: 'Headcount' },
      ],
      edges: [],
    })

    expect(pulseSpy).toHaveBeenCalledTimes(1)
    const { nodeIds, edgeIds } = pulseSpy.mock.calls[0][0]
    expect(nodeIds).toEqual(['factor-1'])
    expect(nodeIds).not.toContain('goal-1')
    expect(nodeIds).not.toContain('factor-2')
    expect(edgeIds).toEqual([])
  })

  it('does NOT pulse when the merge only ADDS — nothing was overwritten', () => {
    mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
        { id: 'factor-2', kind: 'factor', label: 'Headcount' },
      ],
      edges: [],
    })

    // The addition landed…
    expect(useCanvasStore.getState().nodes).toHaveLength(3)
    // …and announced nothing, because nothing of the user's was replaced.
    expect(pulseSpy).not.toHaveBeenCalled()
  })
})
