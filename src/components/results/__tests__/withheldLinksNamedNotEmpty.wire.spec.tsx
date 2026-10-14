/**
 * ⭐ RT-19 fx1 (red team 19, guest T1b-£126k at CEE 5f8f24ce / UI 0a416c9e; DL #87, 6 Oct): the Run withheld its leader
 * for an UNSIZED path, but its warning typed no first ask (nothing it can ask in units), so the Results
 * "Strengthen your model" panel read "No findings need attention right now" while the chat said "Set them to see how much
 * they matter". The panel now NAMES the withhold's own first link (CEE's goal-ordered list) and how many more. The SERVED
 * envelope runs through the real chain: applyV5State (whole store) → useResultsSectionData → the deployed StrengthenContainer.
 */
import { describe, expect, it } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { StrengthenContainer } from '../strengthen/StrengthenContainer'
import { analysisResultsAreCurrentIn } from '../../../canvas/hooks/useAnalysisResultsAreCurrent'
import fixture from './fixtures/rt19-fx1-unnamed-ask.json'

type Rec = Record<string, any>

function hydrate(env: Rec): ReturnType<typeof useResultsSectionData> {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: fixture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label } })),
    edges: [],
  } as never)
  const snapshot = useCanvasStore.getState()
  applyV5State(env as unknown as OlumiResponse, { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results?.report).toBeTruthy() // PRECONDITION: the turn wrote the report
  expect(analysisResultsAreCurrentIn(useCanvasStore.getState() as never)).toBe(true) // PRECONDITION: the envelope's run_state
  return renderHook(() => useResultsSectionData()).result.current
}
const placeholder = (env: Rec): Rec => (env.blocks[0].enrichment.inference_warnings as Rec[]).find((w) => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')!

describe('RT-19 fx1: a withhold with no typed ask names its own links, never "No findings"', () => {
  it('PRECONDITION: the served warning typed no first ask (the key is absent) and lists two links, nearest the goal first', () => {
    const w = placeholder(fixture.envelope as Rec)
    expect(w).not.toHaveProperty('first_ask')
    expect(w.links).toEqual([{ from: 'support_capacity_strain', to: 'monthly_recurring_revenue' }, { from: 'monthly_starter_support_cost', to: 'support_capacity_strain' }])
  })
  it('the deployed panel names the first link and how many more, in the chat\'s words, instead of "No findings"', () => {
    render(<StrengthenContainer data={hydrate(structuredClone(fixture.envelope) as Rec)} />)
    expect(screen.getByText('How strongly does ‘Support capacity strain’ affect ‘monthly recurring revenue’?')).toBeTruthy()
    expect(screen.getByText('Olumi drafted this relationship and 1 more; none is sized in the model yet.')).toBeTruthy()
    expect(screen.queryByText('No findings need attention right now.')).toBeNull()
  })
  it('CONTROL: the same Run with no withhold (leader permitted, no placeholder warning) shows no such row', () => {
    const env = structuredClone(fixture.envelope) as Rec
    env.blocks[0].enrichment.inference_warnings = (env.blocks[0].enrichment.inference_warnings as Rec[]).filter((w) => w.code !== 'GOAL_FIGURES_PLACEHOLDER_PATH')
    env.analysis_state.leader_claim = { permitted: true }
    render(<StrengthenContainer data={hydrate(env)} />)
    expect(screen.queryByText(/^How strongly does ‘Support capacity strain’ affect/)).toBeNull()
  })
})
