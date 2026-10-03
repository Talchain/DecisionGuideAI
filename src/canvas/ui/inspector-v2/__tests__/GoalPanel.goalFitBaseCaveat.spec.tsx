/**
 * ISL #207 (AIQ #72 5877139338): the node inspector's goal chance is never
 * bare when the goal's level today was worked out from its inputs. Served
 * path: a V5 block goes through the REAL mapper (UI #2280 stamps
 * `goalLevelAuthor` from `GOAL_LEVEL_FROM_IDENTITY_INPUTS` + the goal's
 * `identity_evaluations` entry), the store, the hook, and the panel.
 * Both render sites (target line, impact group) carry the copy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
// Pinned as LITERALS (Codex on #2280): a re-worded constant must turn these rows RED.
const OLUMI_COPY = "Measured from Olumi's estimate of where your goal stands today, not a figure you gave."
const NEUTRAL_COPY = 'Measured from where your goal stands today as worked out from its inputs, not a figure you gave.'


vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Ability to focus on high-value tasks', goal_threshold_raw: 0.8 } }

/** `author`: 'olumi' | 'user' → a typed goal entry; 'dropped' → the warning with no entry (carrier lost). */
function report(author: 'olumi' | 'user' | 'dropped' | 'none') {
  const enrichment: Record<string, unknown> = {
    option_comparison: [
      { option_id: 'opt_a', option_label: 'Option A', win_probability: 0.6, probability_of_goal: 0.41 },
      { option_id: 'opt_b', option_label: 'Option B', win_probability: 0.4, probability_of_goal: 0.3 },
    ],
    robustness: { recommended_option_id: 'opt_a', display_verdict: 'fragile' },
  }
  if (author !== 'none') {
    enrichment.inference_warnings = [{ code: 'GOAL_LEVEL_FROM_IDENTITY_INPUTS', field: 'nodes[goal1].nonlinear_identity' }]
    if (author !== 'dropped') {
      enrichment.identity_evaluations = [{ node_id: 'goal1', level_source: 'identity_inputs', level_author: author }]
    }
  }
  const block = { type: 'analysis_result', summary: 's', leading_option_id: 'opt_a', win_probabilities: { 'Option A': 0.6, 'Option B': 0.4 }, enrichment } as unknown as AnalysisResultBlock
  return mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
}

function seed(r: Record<string, unknown>) {
  useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: [GOAL_NODE], edges: [], goalThreshold: 0.8, goalConstraints: null, results: { status: 'complete', report: r } } as never)
}
const renderPanel = () => render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)

describe('GoalPanel — the goal chance carries its base-caveat (served mapper path)', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, user: { id: 'u-1', email: 'u@x.io' } } as never)
  })

  it('PRECONDITION: the mapper stamps the author the rows below rely on', () => {
    const entry = (r: Record<string, unknown>) => (r.option_probabilities as Record<string, Record<string, unknown>>).opt_a
    expect(entry(report('olumi')).goalLevelAuthor).toBe('olumi')
    expect(entry(report('dropped')).goalLevelAuthor).toBe('unattested')
    expect(entry(report('user')).goalLevelAuthor).toBeUndefined()
  })

  it.each([
    ['olumi', OLUMI_COPY],
    ['dropped', NEUTRAL_COPY],
  ] as const)('author %s → the copy beside the chance, at every render site', (author, copy) => {
    seed(report(author))
    renderPanel()
    const sites = screen.getAllByTestId(/^goal-fit-base-caveat-goal-panel-/)
    expect(sites.length).toBeGreaterThanOrEqual(1)
    for (const s of sites) expect(s.textContent).toBe(copy)
    if (author === 'dropped') for (const s of sites) expect(s.textContent).not.toContain("Olumi's")
  })

  it.each(['user', 'none'] as const)('CONTROL: author %s → no base-caveat, the chance still shows', (author) => {
    seed(report(author))
    renderPanel()
    expect(screen.getAllByText(/41%/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByTestId(/^goal-fit-base-caveat-goal-panel-/)).toHaveLength(0)
  })
})
