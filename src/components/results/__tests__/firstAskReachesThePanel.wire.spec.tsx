/**
 * ⭐ RT-19 (red team 19, #87 6009883744; DL: fix forward, priority): CEE served `first_ask` on the placeholder withhold, yet
 * the Results "Strengthen your model" panel read "No findings need attention right now". Cause: the results adapter
 * (`useResultsSectionData` → `confidence.inferenceWarnings`) rebuilt each warning field by field and DROPPED `first_ask`
 * — the loss its own comment warns is "invisible to unit tests that feed raw producer shapes straight past this adapter".
 * This row runs the SERVED fa2 payload (CEE fcb53c17) through the real chain: applyV5State → store report →
 * useResultsSectionData → the reader the deployed StrengthenContainer calls.
 */
import { describe, expect, it } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { StrengthenContainer } from '../strengthen/StrengthenContainer'
import { analysisResultsAreCurrentIn } from '../../../canvas/hooks/useAnalysisResultsAreCurrent'
import { unsizedPathAskOf } from '../analysisNew/analysisNewCopy'
import { resultBoundLeaderWithholdCause } from '../analysisNew/useAnalysisNewViewModel'
import fixture from './fixtures/rt19-fa2-first-ask.json'

/** As the ONE production caller (`useConversation`) does: the whole canvas store, its results hash beside it. */
function hydrate(): void {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: fixture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label } })),
    edges: [],
  } as never)
  const snapshot = useCanvasStore.getState()
  applyV5State(fixture.envelope as unknown as OlumiResponse, { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results?.report).toBeTruthy() // PRECONDITION: the turn wrote the report
}

describe('RT-19: the served first_ask reaches the panel\'s reader', () => {
  it('the adapter carries the typed first_ask on the placeholder withhold (it used to drop it)', () => {
    hydrate()
    const data = renderHook(() => useResultsSectionData()).result.current
    const ph = (data.confidence.inferenceWarnings ?? []).find((w: { code: string }) => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH') as Record<string, unknown> | undefined
    expect(ph?.first_ask).toEqual({ kind: 'link', from: 'starter_tier_monthly_price', to: 'starter_tier_monthly_recurring_revenue' })
  })
  it('…so the deployed panel\'s reader names the served ask (the stamp\'s real cause, the canvas labels)', () => {
    hydrate()
    const data = renderHook(() => useResultsSectionData()).result.current
    const cause = resultBoundLeaderWithholdCause(useCanvasStore.getState().results?.report?.producer_leader_permission)
    expect(cause).toBe('goal_path_unsized') // PRECONDITION: the served withhold
    const labels = new Map(fixture.nodes.map((n) => [n.id, n.label] as const))
    expect(unsizedPathAskOf(cause, data.confidence.inferenceWarnings, (id) => labels.get(id))).toEqual({
      kind: 'link', fromId: 'starter_tier_monthly_price', toId: 'starter_tier_monthly_recurring_revenue',
      from: 'Starter tier monthly price', to: 'Starter-tier monthly recurring revenue',
    })
  })
  it('DEPLOYED SURFACE (fa2 read "No findings need attention right now" on the Results tab): the panel names the ask', () => {
    hydrate()
    expect(analysisResultsAreCurrentIn(useCanvasStore.getState() as never)).toBe(true) // PRECONDITION: the served envelope's own run_state
    const data = renderHook(() => useResultsSectionData()).result.current
    render(<StrengthenContainer data={data} />)
    expect(screen.getByText('Set the strength of the link from ‘Starter tier monthly price’ to ‘Starter-tier monthly recurring revenue’')).toBeTruthy()
    expect(screen.queryByText('No findings need attention right now.')).toBeNull()
  })
})
