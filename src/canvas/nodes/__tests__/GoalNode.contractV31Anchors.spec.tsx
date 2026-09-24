/**
 * Canvas visual contract v3.1 — the GOAL anchor's frame, target row and state
 * words (wave 3 "anchors": ANC-01, ANC-06/PILL-04, ANC-07/T07, ANC-13,
 * FRAME-10, PILL-12).
 *
 *   ANC-01    every card has a solid 1px border in its kind hue; a dash means
 *             EXISTENCE doubt only, "never used for fragility". The goal used to
 *             re-draw itself from the robustness verdict (danger/info DASHED, and
 *             a near-invisible panel-border dash for a post-run goal with no
 *             target). It now always renders the goal's kind-hue frame
 *             (`nodeColors.goal.frame`, FRAME-08), solid.
 *   ANC-06 /  the "Target not captured" chip is the contract's neutral
 *   PILL-04   `.state-word` (hairline on the panel), not a warning fill with a
 *             full-strength ink ring.
 *   ANC-07 /  the target is the goal's one recorded quantity and reads in ink
 *   T07       (text-body); the dotted route rule stays, in the secondary colour.
 *   ANC-13 /  the target row: 7px title gap (`.node.wide`), baseline-aligned,
 *   FRAME-10  a counter-scaled gap capped at the 8px it replaced.
 *   PILL-12   Layer 2's "Marginal" uses the same state word; constraint badges
 *             use the neutral mini-pill line, not an Info ring.
 *
 * Bound by IDENTITY: test ids and exact class TOKENS (split on whitespace, so
 * `decoration-text-light` can never satisfy an assertion about `text-text-light`).
 *
 * CLAIM SCOPE: jsdom proves the DOM's classes and attributes, never layout or
 * computed colour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { nodeColors } from '../colors'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import {
  GoalNode,
  GOAL_TARGET_ROUTE_TESTID,
  GOAL_STATE_WORD_CLASSES,
  GOAL_STATE_WORD_STYLE,
} from '../GoalNode'

const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const META = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null as number | null,
  goalFitAvailable: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: false,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
}

function mockStore(over: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
      analysisFreshnessDirty: false,
      ...over,
    } as never),
  )
}

function renderGoal(data: Record<string, unknown>, id = 'goal-1') {
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} id={id} type="goal" data={{ type: 'goal', label: 'Grow net revenue', ...data } as any} />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element | null): string[] => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const card = (container: HTMLElement) => container.querySelector('[role="group"]')

const WITH_TARGET = { goal_threshold_raw: '100', goal_threshold_unit: '%' }
const runWith = (level: string, stability = 0.45) => ({
  results: { status: 'complete', report: { robustness: { recommendation_stability: stability, level } } },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...META } as never)
})
afterEach(() => cleanup())

describe('ANC-01 — the goal frame is solid in its kind hue whatever the robustness verdict', () => {
  it.each([
    ['low', 0.45],
    ['very_low', 0.2],
    ['moderate', 0.65],
  ])('after a run graded %s, with a target: border-goal, no dash, no danger/info recolour', (level, stability) => {
    mockStore(runWith(level, stability))
    const { container } = renderGoal(WITH_TARGET)
    const t = tokens(card(container))
    // The goal's own kind-hue frame token (contract v3.1 FRAME-08: the kind hue
    // at 76% toward the warm neutral) — read from the one source, not restated.
    expect(t).toContain(nodeColors.goal.frame)
    expect(t).not.toContain('border-dashed')
    expect(t).not.toContain('border-danger')
    expect(t).not.toContain('border-info')
  })

  it('after a run, a goal with NO target keeps a visible kind-hue frame (never the ~1.2:1 panel-border dash)', () => {
    mockStore(runWith('high', 0.9))
    const { container } = renderGoal({})
    const t = tokens(card(container))
    // The goal's own kind-hue frame token (contract v3.1 FRAME-08: the kind hue
    // at 76% toward the warm neutral) — read from the one source, not restated.
    expect(t).toContain(nodeColors.goal.frame)
    expect(t).not.toContain('border-panel-border')
    expect(t).not.toContain('border-dashed')
  })

  it('CONTRAST: the verdict is still stated in WORDS in Layer 2 (Decision stability + Marginal)', () => {
    mockStore({ ...runWith('low', 0.45), viewMode: 'expert' })
    renderGoal(WITH_TARGET)
    expect(screen.getByText('Decision stability')).toBeDefined()
    expect(screen.getByText('Marginal', { selector: 'span' })).toBeDefined()
  })
})

describe('ANC-06 / PILL-04 — "Target not captured" is a neutral state word', () => {
  it('carries the state-word anatomy and no warning fill or full-strength ink ring', () => {
    mockStore()
    renderGoal({})
    const chip = screen.getByTestId('goal-node-no-target-chip')
    const t = tokens(chip)
    // The literal anatomy first, so this reds on the served classes rather
    // than on a missing export.
    expect(t).not.toContain('bg-warning/10')
    expect(t).not.toContain('hover:bg-warning/20')
    expect(t).not.toContain('border-warning-ink')
    expect(t).toContain('bg-panel')
    expect(t).toContain('border-warning-ink/40')
    expect(t).toContain('rounded-full')
    expect(t).toContain('text-text-body')
    expect(t).toContain('hover:bg-panel-hover')
    expect((chip as HTMLElement).style.padding).toBe('0.1em 0.6em')
    expect((chip as HTMLElement).style.lineHeight).toBe('1.3')
    // The hit slop and focus ring the chip already earned are kept.
    expect(t).toContain("before:-inset-[3px]")
    expect(t).toContain('focus-visible:ring-info')
    // …and it IS the shared state word, so it cannot drift from "Marginal".
    for (const cls of GOAL_STATE_WORD_CLASSES.split(/\s+/)) expect(t).toContain(cls)
    expect((chip as HTMLElement).style.padding).toBe(GOAL_STATE_WORD_STYLE.padding)
  })
})

describe('ANC-07 / T07 — the target reads in ink; its route rule is secondary', () => {
  it('the route button is text-body with a text-light dotted rule, Info on hover', () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const t = tokens(screen.getByTestId(GOAL_TARGET_ROUTE_TESTID))
    expect(t).toContain('text-text-body')
    expect(t).not.toContain('text-text-light')
    expect(t).toContain('decoration-text-light')
    expect(t).toContain('decoration-dotted')
    expect(t).toContain('hover:text-info')
  })

  // NODE-ANATOMY v3.2 principle 3 ("No link text inside a card … on hover or
  // focus") + contract v3.1 `.target-row` (a plain `<span>`, the edit route in
  // the rail on hover/focus) supersede T07's resting rule: Paul 24 Sep saw
  // "Target: 20,000 GBP/month" underlined at rest. The factor value editor's
  // precedent — "rests as text … editable on hover and on focus".
  it('the target rests as plain text: the dotted rule appears on hover and keyboard focus only', () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const t = tokens(screen.getByTestId(GOAL_TARGET_ROUTE_TESTID))
    expect(t, 'a resting underline reads as link text inside the card').not.toContain('underline')
    expect(t).toContain('hover:underline')
    expect(t).toContain('focus-visible:underline')
  })
})

describe('ANC-13 / FRAME-10 — the target row geometry', () => {
  it('7px title gap (header 4 + 3), shared baseline, counter-scaled gap capped at 8px', () => {
    mockStore()
    renderGoal(WITH_TARGET)
    const t = tokens(screen.getByTestId('goal-node-resting-state'))
    expect(t).toContain('mt-[3px]')
    expect(t).not.toContain('mt-1')
    expect(t).toContain('items-baseline')
    expect(t).not.toContain('items-center')
    expect(t).toContain('gap-x-[min(8px,calc(7px*var(--canvas-label-scale,1)))]')
    expect(t).not.toContain('gap-x-2')
  })
})

describe('PILL-12 — Layer 2 pills', () => {
  it('"Marginal" uses the goal state word, with no vertical padding so the row does not grow', () => {
    mockStore({ ...runWith('low', 0.45), viewMode: 'expert' })
    renderGoal(WITH_TARGET)
    // Bound by exact text within the stability row, so the served build (which
    // had no test id here) reds on its classes rather than on a lookup.
    const marginal = screen.getByText('Marginal', { selector: 'span' })
    const t = tokens(marginal)
    expect(t).not.toContain('border-warning/30')
    expect(t).toContain('border-warning-ink/40')
    expect((marginal as HTMLElement).style.paddingTop).toBe('0px')
    expect((marginal as HTMLElement).style.paddingLeft).toBe('0.6em')
    for (const cls of GOAL_STATE_WORD_CLASSES.split(/\s+/)) expect(t).toContain(cls)
    expect(marginal.getAttribute('data-testid')).toBe('goal-stability-marginal')
  })

  it('a constraint badge uses the neutral mini-pill line (border-field/40, 1px x 7px), not an Info ring', () => {
    mockStore({
      viewMode: 'expert',
      goalConstraints: [
        { id: 'c1', node_id: 'churn', operator: '<', value: 4, unit: '%', label: 'Churn under 4%' },
      ],
    })
    renderGoal(WITH_TARGET)
    const badge = screen.getByTestId('goal-constraint-badge')
    const t = tokens(badge)
    expect(t).toContain('border-field/40')
    expect(t).not.toContain('border-info/30')
    expect(t).toContain('px-[7px]')
    expect(t).toContain('py-px')
    expect(t).not.toContain('py-0.5')
  })
})
