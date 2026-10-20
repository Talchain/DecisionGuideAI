/**
 * Paul 23 Sep contract feedback point 1, on the GOAL card: the target line names
 * its source, and a CEE-supplied figure is never presented as the user's own.
 *
 * The case is a real starter, not an invented one: the market-entry goal carries
 * `goal_threshold_raw: 11` ("£M ARR", node `provenance: 'ai_inferred'`) while
 * its brief states "£8M ARR" and no target. Before this pass the card printed
 * "Target: 11 £M ARR"-style text with no mark at all.
 *
 * Bound by IDENTITY: the mark is read by its node-scoped test id and its kind
 * from `data-value-source`.
 *
 * CLAIM SCOPE: jsdom proves DOM text/attributes only, never layout or contrast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import marketEntry from '../../starters/data/market-entry.draft.json'
import { GoalNode, GOAL_TARGET_ROUTE_IS_LIVE, GOAL_TARGET_ROUTE_TESTID, goalTargetRouteChannels } from '../GoalNode'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null, goalConstraints: [], nodes: [], edges: [],
  ceeAnalysisReady: null, viewMode: 'expert',
})
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

type RawNode = { id: string; kind: string; label: string } & Record<string, unknown>
const graph = (marketEntry as { graph?: { nodes: RawNode[] }; nodes?: RawNode[] })
const MARKET_ENTRY_GOAL = (graph.graph?.nodes ?? graph.nodes ?? []).find(n => n.kind === 'goal')!

function renderGoal(id: string, data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode id={id} type="goal" data={{ type: 'goal', ...data } as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </ReactFlowProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('the goal target line names its source (Paul 23 Sep point 1)', () => {
  it('FIXTURE GUARD: the market-entry goal is the CEE-supplied, not-user-set case', () => {
    expect(MARKET_ENTRY_GOAL.goal_threshold_raw).toBe(11)
    expect(MARKET_ENTRY_GOAL.threshold_source).toBeUndefined()
  })

  it('market-entry: the CEE figure is marked "no source" — never unmarked, never "you"', () => {
    const { id, ...data } = MARKET_ENTRY_GOAL
    const { container } = renderGoal(id, data)
    const resting = container.querySelector('[data-testid="goal-node-resting-state"]')!
    expect(resting.textContent ?? '').toMatch(/11/) // the target line itself is on the card
    const m = container.querySelector(`[data-testid="goal-target-source-${id}"]`)
    expect(m, 'the target line must carry a source mark').not.toBeNull()
    expect(m!.getAttribute('data-value-source')).toBe('unknown')
    expect(m!.querySelector('.lucide-help-circle')).not.toBeNull()
    expect(m!.querySelector('.sr-only')!.textContent).toBe('Source not recorded')
    // Spoken and hovered on the route control too — not sight-only.
    const route = container.querySelector(`[data-testid="${GOAL_TARGET_ROUTE_TESTID}"]`)
    expect(route === null).toBe(!GOAL_TARGET_ROUTE_IS_LIVE)
    if (GOAL_TARGET_ROUTE_IS_LIVE) {
      expect(route!.getAttribute('aria-label') ?? '').toContain('Source not recorded')
      expect(route!.getAttribute('title') ?? '').toContain('Source not recorded')
    }
  })

  it('the route control speaks and hovers the source (both branches reached by execution)', () => {
    const live = goalTargetRouteChannels({ targetLine: 'Target: 11', routeIsLive: true, sourceLabel: 'Source not recorded' })
    expect(live?.['aria-label']).toContain('Target: 11 (Source not recorded)')
    expect(live?.title).toMatch(/^Source not recorded\. /)
    expect(goalTargetRouteChannels({ targetLine: 'Target: 11', routeIsLive: false, sourceLabel: 'Source not recorded' })).toBeNull()
  })

  it('CONTRAST — a user-attested target (threshold_source: user) is marked "you"', () => {
    const { container } = renderGoal('goal-user', {
      label: 'Grow ARR', success_threshold: 12, threshold_source: 'user', goal_threshold_unit: '£M ARR',
    })
    const m = container.querySelector('[data-testid="goal-target-source-goal-user"]')
    expect(m?.getAttribute('data-value-source')).toBe('you')
    expect(m?.querySelector('.sr-only')?.textContent).toBe('Set by you')
  })

  it('a stale user stamp with no stated user figure falls back to CEE’s figure AND its mark — never "you"', () => {
    const { container } = renderGoal('goal-stale', {
      label: 'Grow ARR', threshold_source: 'user', success_threshold: '', goal_threshold_raw: 11, goal_threshold_unit: '£M ARR',
    })
    expect(container.querySelector('[data-testid="goal-target-source-goal-stale"]')?.getAttribute('data-value-source')).toBe('unknown')
  })

  it('no target → no mark (nothing to attribute)', () => {
    const { container } = renderGoal('goal-none', { label: 'Grow ARR' })
    expect(container.querySelector('[data-testid="goal-target-source-goal-none"]')).toBeNull()
  })
})

describe('a saved goal target retains its declared source on the canvas (L25)', () => {
  const fetch = vi.fn(() => { throw new Error('No provider calls permitted') })
  beforeEach(() => { vi.stubGlobal('fetch', fetch) })
  afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals() })

  const briefs = [
    { id: 'weekly_support_capacity', label: 'Weekly support capacity', goal_threshold_raw: 100,
      goal_threshold_unit: 'tickets per week', source_quote: 'Goal: weekly support capacity of at least 100 tickets per week.' },
    { id: 'monthly_orders', label: 'Monthly orders', goal_threshold_raw: 250,
      goal_threshold_unit: 'orders per month', source_quote: 'Our target is 250 orders per month.' },
  ]

  function expectSource(wire: Record<string, unknown>, kind: string, label: string) {
    const node = mapDraftNodeToCanvas({ kind: 'goal', goal_threshold_frame: 'level', ...wire })
    const { container } = renderGoal(node.id, node.data)
    expect(within(container).getByText(wire.label as string, { exact: true })).toBeDefined()
    const mark = container.querySelector(`[data-testid="goal-target-source-${node.id}"]`)
    expect(mark?.getAttribute('data-value-source')).toBe(kind)
    expect(mark?.querySelector('.sr-only')?.textContent).toBe(label)
    expect(mark?.getAttribute('aria-label')).toBe(`Target: ${label}`)
  }

  it.each(briefs)('$id: the target-specific brief stamp shows From your brief', (goal) => {
    expectSource({ ...goal, provenance: 'from_brief', threshold_source: 'brief_extraction' }, 'brief', 'From your brief')
  })

  it.each(briefs)('$id: cee_inference shows Olumi’s estimate despite node-level brief credit', (goal) => {
    expectSource({ ...goal, provenance: 'from_brief', threshold_source: 'cee_inference',
      observed_state: { raw_value: 80, source: 'brief_extraction' } }, 'olumi', 'Olumi’s estimate')
  })

  it.each(['inferred', 'proxy'])('a target-specific brief stamp wins over stale %s node provenance', (provenance) => {
    expectSource({ ...briefs[0], provenance, threshold_source: 'brief_extraction' }, 'brief', 'From your brief')
  })

  it.each(['inferred', 'proxy'])('%s stays Olumi’s estimate even with a quotation', (provenance) => {
    expectSource({ ...briefs[0], provenance }, 'olumi', 'Olumi’s estimate')
  })

  it.each([
    { provenance: undefined, source_quote: undefined },
    { provenance: 'from_brief', source_quote: undefined },
    { provenance: 'from_brief', source_quote: '   ' },
    { provenance: undefined },
    { provenance: 'unverified_brief' },
    { provenance: 'from_brief', source_quote: undefined,
      observed_state: { raw_value: 80, source: 'brief_extraction' } },
  ])('missing/unverified target source stays unknown: %j', (fields) => {
    expectSource({ ...briefs[0], ...fields }, 'unknown', 'Source not recorded')
  })

  it('a neighbouring goal with the same label and value cannot lend its authorship', () => {
    expectSource({ ...briefs[0], provenance: 'from_brief', threshold_source: 'brief_extraction' }, 'brief', 'From your brief')
    expectSource({ ...briefs[0], id: 'unrecorded_goal', source_quote: undefined }, 'unknown', 'Source not recorded')
  })

  it('REVIEW: a quote stating only today cannot credit an unrecorded target', () => {
    expectSource({ ...briefs[0], provenance: 'from_brief',
      source_quote: 'We currently handle 80 tickets per week.',
      observed_state: { raw_value: 80, source: 'brief_extraction' } },
      'unknown', 'Source not recorded')
  })

  it('REVIEW: changing 100→150 cannot reuse the previous target quotation', () => {
    // The existing inspector setter changes raw/unit without attesting authorship.
    const saved = { ...briefs[0], provenance: 'from_brief' }
    expectSource({ ...saved, goal_threshold_raw: 150 }, 'unknown', 'Source not recorded')
  })

  it('a user-stamped edit to 150 takes the editor attribution over the old brief quote', () => {
    expectSource({ ...briefs[0], provenance: 'from_brief',
      threshold_source: 'user', success_threshold: 150 }, 'you', 'Set by you')
  })

  it.each(briefs)('$id: a node quote without the target stamp stays unknown', (goal) => {
    expectSource({ ...goal, provenance: 'from_brief' }, 'unknown', 'Source not recorded')
  })

})
