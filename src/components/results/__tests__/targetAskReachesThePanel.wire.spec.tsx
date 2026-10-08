/**
 * ⭐ NEAR TIE (red team 19, ts2-r2 at CEE 328d01fe / UI 96773356; DL #87, 6 Oct): the Run withheld its leader for a near
 * tie, and its GOAL_FIGURES_TARGET_NOT_TESTABLE `say` asked for "Support capacity strain → monthly recurring revenue" in the
 * target's unit, while the Results "Strengthen your model" panel offered a different input. CEE now types that link on the
 * warning (`first_ask`); this row runs the SERVED envelope through the real chain (applyV5State with the whole store, as
 * `useConversation` passes it → useResultsSectionData → the deployed StrengthenContainer), once as served (CONTROL: no
 * `first_ask`, today's own next input byte for byte) and once with the one field the CEE half adds.
 */
import { describe, expect, it } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { StrengthenContainer } from '../strengthen/StrengthenContainer'
import { unsizedPathAskOf } from '../analysisNew/analysisNewCopy'
import { resultBoundLeaderWithholdCause } from '../analysisNew/useAnalysisNewViewModel'
import { analysisResultsAreCurrentIn } from '../../../canvas/hooks/useAnalysisResultsAreCurrent'
import fixture from './fixtures/ts2-near-tie-target-ask.json'

type Rec = Record<string, any>
const STRAIN = 'support_capacity_strain'
const MRR = 'monthly_recurring_revenue'

/** The served envelope, optionally with the target warning's typed ask (what the CEE half now adds). */
function envelope(withAsk: boolean): Rec {
  const env = structuredClone(fixture.envelope) as Rec
  if (withAsk) {
    const w = (env.blocks[0].enrichment.inference_warnings as Rec[]).find((x) => x.code === 'GOAL_FIGURES_TARGET_NOT_TESTABLE')!
    w.first_ask = { kind: 'link', from: STRAIN, to: MRR }
  }
  return env
}

function hydrate(withAsk: boolean): ReturnType<typeof useResultsSectionData> {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: fixture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label } })),
    edges: [],
  } as never)
  const snapshot = useCanvasStore.getState()
  applyV5State(envelope(withAsk) as unknown as OlumiResponse, { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results?.report).toBeTruthy() // PRECONDITION: the turn wrote the report
  expect(analysisResultsAreCurrentIn(useCanvasStore.getState() as never)).toBe(true) // PRECONDITION: the envelope's own run_state
  return renderHook(() => useResultsSectionData()).result.current
}
const cause = () => resultBoundLeaderWithholdCause(useCanvasStore.getState().results?.report?.producer_leader_permission)
const labels = () => new Map(fixture.nodes.map((n) => [n.id, n.label] as const))

describe('near tie: the target warning\'s typed ask reaches the deployed panel', () => {
  it('PRECONDITION: the served withhold is a near tie, not an unsized path', () => {
    hydrate(false)
    expect(cause()).toBe('options_do_not_separate')
  })
  it('CONTROL (as served, no first_ask): no ask is read, so the panel keeps its own next input, unchanged', () => {
    const data = hydrate(false)
    expect(unsizedPathAskOf(cause(), data.confidence.inferenceWarnings, (id) => labels().get(id))).toBeUndefined()
    render(<StrengthenContainer data={data} />)
    expect(screen.queryByText(/^How strongly does ‘Support capacity strain’ affect/)).toBeNull()
  })
  it('with the CEE half\'s first_ask: the panel leads with that link, the one the chat asks for', () => {
    const data = hydrate(true)
    expect(unsizedPathAskOf(cause(), data.confidence.inferenceWarnings, (id) => labels().get(id))).toEqual({
      kind: 'target_link', fromId: STRAIN, toId: MRR, from: 'Support capacity strain', to: 'monthly recurring revenue',
    })
    render(<StrengthenContainer data={data} />)
    expect(screen.getByText('How strongly does ‘Support capacity strain’ affect ‘monthly recurring revenue’?')).toBeTruthy()
    expect(screen.getByText('Olumi can’t test your target until this link has a size in the target’s unit.')).toBeTruthy()
  })
})
