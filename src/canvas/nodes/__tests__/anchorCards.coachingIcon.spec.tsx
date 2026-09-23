/**
 * D4 · ONE COACHING ICON on the Question, Goal, Outcome and Risk cards.
 *
 * Locked Experience Design (Paul-approved, 23 Sep 2026): *"Coaching becomes ONE
 * consistent icon on the card surface."* Every one of these four cards carried
 * a permanent row of coaching chips on its resting face ("What would we see
 * first?", "How likely is this?", "What would falsify this?", "Is this the real
 * goal?", "Explore more options", "What could go wrong?"). The row becomes one
 * icon whose question is the one the resolver would have put FIRST, and whose
 * click pre-fills that question with THIS node in context.
 *
 * ─── HOW EACH RULE IS BOUND ─────────────────────────────────────────────────
 *
 *  (a) At rest (Standard view) the card surface carries EXACTLY ONE icon and
 *      NONE of the card-surface chip labels — every label the resolver returns
 *      for that surface is checked, not a hand-picked one.
 *  (b) The icon's accessible name and chip id are the resolver's FIRST chip,
 *      computed in-test by calling the REAL `resolveNodeCoaching` with the
 *      fixture's own inputs. No expected string is typed here, so no string
 *      the code could produce by accident can satisfy it.
 *  (c) Clicking it goes through the EXISTING ask seam (`requestAsk`, spied
 *      pass-through) carrying the node id as `targetId`, the chip's message
 *      as the draft and its id as `chip_id`, and selects the node first.
 *  (d) The controls that must NOT move — each written so it would fail if the
 *      rule it guards were broken, and each GREEN at base where it describes
 *      unchanged behaviour.
 *
 * ─── THE "CARD SURFACE" IS THE CARD MINUS THE POPOVER ───────────────────────
 *
 * `NodePopover` is mocked into an always-rendering wrapper so that what a
 * HOVER would show is in the DOM and can be asserted on BOTH sides: the
 * popover keeps its chips (unchanged), and the card outside it carries none.
 * Stripping the wrapper is how "on the card" is told apart from "behind a
 * hover" — the same instrument `DecisionNode.invitations.spec.tsx` uses.
 *
 * CLAUDE.md trap 3: presence and absence of DOM and text only. jsdom proves
 * nothing about paint, height or position, and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type React from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode, RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { OutcomeNode } from '../OutcomeNode'
import { GoalNode, GOAL_NO_TARGET_STATE } from '../GoalNode'
import { DecisionNode, composeOptionCountLine } from '../DecisionNode'
import { resolveNodeCoaching, type CoachingChip, type NodeCoachingRequest } from '../coaching/resolveNodeCoaching'
import { calculateRiskSeverity } from '../../utils/graphDisplayCalculations'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null }),
  ),
}))

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../../hooks/useNodeConnections', () => ({ useNodeConnections: vi.fn(() => []) }))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))

vi.mock('../../hooks/useAnalysisTrust', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAnalysisTrust')>()
  return { ...actual, useAnalysisTrust: vi.fn(() => ({ semantic: 'current' })) }
})

// What a hover shows, always rendered, inside a wrapper the card-surface reader strips.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hover-popover">{children}</div>
  ),
}))

// Pass-through spy on the EXISTING ask seam — its real routing still runs.
vi.mock('../../ui/inspector-v2/askSemantic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ui/inspector-v2/askSemantic')>()
  return { ...actual, requestAsk: vi.fn(actual.requestAsk) }
})

const hoisted = vi.hoisted(() => ({ state: null as any, select: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useNodeConnections } from '../../hooks/useNodeConnections'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'

type View = 'standard' | 'expert'

function setStore(over: Record<string, unknown> = {}) {
  hoisted.select = vi.fn()
  hoisted.state = {
    hoveredOptionId: null,
    nodes: [],
    edges: [],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'standard',
    selectNodeWithoutHistory: hoisted.select,
    ...over,
  }
}

const baseProps = {
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const ICON_PREFIX = 'node-coaching-icon-'

/** The card as a non-hovering reader has it: everything outside the popover. */
function cardSurface(container: HTMLElement): HTMLElement {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-testid="hover-popover"]').forEach(n => n.remove())
  return clone
}

function iconsOn(surface: HTMLElement, nodeId: string): HTMLElement[] {
  return Array.from(surface.querySelectorAll<HTMLElement>(`[data-testid="${ICON_PREFIX}${nodeId}"]`))
}

function chipsOf(req: NodeCoachingRequest): readonly CoachingChip[] {
  const chips = resolveNodeCoaching(req)
  // A null resolution would make every "no chip text" assertion vacuous.
  if (!chips || chips.length === 0) throw new Error('refusing to assert: fixture resolves to no chips')
  return chips
}

/** (a) + (b): exactly one icon, the FIRST chip's identity, and no card-surface chip text. */
function assertOneIconNoChips(container: HTMLElement, nodeId: string, chips: readonly CoachingChip[]) {
  const card = cardSurface(container)
  const icons = iconsOn(card, nodeId)
  expect(icons.length, 'exactly one coaching icon on the card surface').toBe(1)
  expect(icons[0].getAttribute('aria-label')).toBe(chips[0].label)
  expect(icons[0].getAttribute('data-coaching-chip-id')).toBe(chips[0].id)
  const text = card.textContent ?? ''
  for (const chip of chips) {
    expect(text, `card-surface chip "${chip.label}" is still painted at rest`).not.toContain(chip.label)
  }
}

/** (c): the click goes through the existing seam with this node in context. */
function assertClickAsks(container: HTMLElement, nodeId: string, chip: CoachingChip) {
  const icon = iconsOn(cardSurface(container), nodeId)[0]
  if (!icon) throw new Error('refusing to assert: no icon to click')
  // Click the LIVE element, not the clone.
  fireEvent.click(container.querySelector(`[data-testid="${ICON_PREFIX}${nodeId}"]`) as HTMLElement)
  expect(requestAsk).toHaveBeenCalledTimes(1)
  expect(vi.mocked(requestAsk).mock.calls[0][0]).toEqual(
    expect.objectContaining({
      text: chip.message,
      label: chip.label,
      targetId: nodeId,
      parameters: { chip_id: chip.id },
    }),
  )
  expect(hoisted.select).toHaveBeenCalledWith(nodeId)
}

const DISPLAY_DEFAULTS = {
  sensitivityRank: null, influence: null, confidence: null,
  inSensitivityAnalysis: false, achievementProbability: null,
  stabilityPercentage: null, winRate: null, isResultsMode: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  setStore()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue(DISPLAY_DEFAULTS as any)
  vi.mocked(useNodeConnections).mockReturnValue([])
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'current' } as any)
  useGuidanceStore.setState({
    guidanceItems: [],
    _dispatchAction: vi.fn(),
    _sendMessage: null,
    _prefillChat: null,
  } as never)
})
afterEach(() => cleanup())

// ─── Risk ───────────────────────────────────────────────────────────────────

const RISK_ID = 'risk-1'
const RISK_LABEL = 'Key person dependency'
const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...baseProps} id={RISK_ID} type="risk" data={{ label: RISK_LABEL, type: 'risk', ...data }} />
    </ReactFlowProvider>,
  )
const riskReq = (surface: 'card' | 'popover' | 'detailed', exposureUnstated: boolean): NodeCoachingRequest => ({
  kind: 'risk', surface, state: { exposureUnstated }, context: { label: RISK_LABEL, riskContext: '' },
})
const SEVERITY_BADGE = /^(Low|Medium|High|Critical) Risk$/

describe('Risk card', () => {
  it.each(['idle', 'complete'] as const)('(a)(b) %s: one icon carrying the first card question; no chip row at rest', (status) => {
    setStore({ results: { status, report: status === 'complete' ? {} : null } })
    const { container } = renderRisk()
    assertOneIconNoChips(container, RISK_ID, chipsOf(riskReq('card', true)))
  })

  it('(c) click asks through requestAsk with this node in context', () => {
    const { container } = renderRisk()
    assertClickAsks(container, RISK_ID, chipsOf(riskReq('card', true))[0])
  })

  it('(b) the question follows the resolver when the risk IS sized — identity, not a fixed string', () => {
    const { container } = renderRisk({ probability: 0.7, impact: 'high' })
    assertOneIconNoChips(container, RISK_ID, chipsOf(riskReq('card', false)))
  })

  it('(d) sized risk: "NN% likely · High impact" at rest; the DERIVED severity badge only in Detailed', () => {
    const severity = calculateRiskSeverity(0.7, 'high')
    expect(severity, 'fixture must derive a severity or the badge assertions are vacuous').not.toBeNull()
    const badge = `${severity!.charAt(0).toUpperCase()}${severity!.slice(1)} Risk`

    const standard = renderRisk({ probability: 0.7, impact: 'high' })
    expect(screen.getByTestId('risk-exposure-line').textContent).toContain('70% likely · High impact')
    expect(screen.queryByText(badge), 'derived severity badge must not show at rest').toBeNull()
    standard.unmount()

    setStore({ viewMode: 'expert' })
    renderRisk({ probability: 0.7, impact: 'high' })
    expect(screen.getByText(badge)).toBeDefined()
    expect(screen.getByTestId('risk-exposure-line').textContent).toContain('70% likely · High impact')
  })

  it.each(['standard', 'expert'] as const)('(d) unsized risk (%s): the unset line, and NO severity badge anywhere', (viewMode: View) => {
    setStore({ viewMode })
    const { container } = renderRisk()
    expect(screen.getByTestId('risk-exposure-unset').textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
    const badges = Array.from(container.querySelectorAll('*')).filter(
      el => el.children.length === 0 && SEVERITY_BADGE.test((el.textContent ?? '').trim()),
    )
    expect(badges).toHaveLength(0)
  })

  it('(d) popover chips unchanged: the Standard hover still carries the popover resolution', () => {
    const { container } = renderRisk()
    const popover = container.querySelector('[data-testid="hover-popover"]') as HTMLElement
    expect(popover).not.toBeNull()
    for (const chip of chipsOf(riskReq('popover', true))) expect(popover.textContent).toContain(chip.label)
  })

  it('(d) Detailed unchanged: the full detailed chip row inline, and no icon beside it', () => {
    setStore({ viewMode: 'expert' })
    const { container } = renderRisk()
    const card = cardSurface(container)
    for (const chip of chipsOf(riskReq('detailed', true))) expect(card.textContent).toContain(chip.label)
    expect(iconsOn(card, RISK_ID)).toHaveLength(0)
  })
})

// ─── Outcome ────────────────────────────────────────────────────────────────

const OUTCOME_ID = 'outcome-1'
const OUTCOME_LABEL = 'Revenue growth'
const renderOutcome = () =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...baseProps} id={OUTCOME_ID} type="outcome" data={{ label: OUTCOME_LABEL, type: 'outcome' }} />
    </ReactFlowProvider>,
  )
const outcomeReq = (surface: 'card' | 'popover' | 'detailed', isPostAnalysis: boolean): NodeCoachingRequest => ({
  kind: 'outcome', surface, state: { isPostAnalysis }, context: { label: OUTCOME_LABEL, outcomeContext: '' },
})
const INBOUND = [{
  edgeId: 'e-f1', connectedNodeId: 'f1', connectedNodeKind: 'factor',
  connectedNodeLabel: 'Price point', confidencePct: null,
}]

describe('Outcome card', () => {
  it.each([false, true])('(a)(b) post-analysis=%s: one icon carrying the first card question; no chip row at rest', (post) => {
    setStore({ results: { status: post ? 'complete' : 'idle', report: post ? {} : null } })
    const { container } = renderOutcome()
    assertOneIconNoChips(container, OUTCOME_ID, chipsOf(outcomeReq('card', post)))
  })

  it('(c) click asks through requestAsk with this node in context', () => {
    const { container } = renderOutcome()
    assertClickAsks(container, OUTCOME_ID, chipsOf(outcomeReq('card', false))[0])
  })

  it('(d) "Depends on:" is ABSENT from Standard — card AND hover — and PRESENT in Detailed', () => {
    vi.mocked(useNodeConnections).mockImplementation(((_id: string, dir: string) =>
      dir === 'inbound' ? INBOUND : []) as never)
    setStore({ results: { status: 'complete', report: {} } })
    const standard = renderOutcome()
    // Positive control on the same render: the connection IS known to the card
    // (the validate prompt names it), so the absence below is not a blind probe.
    expect(standard.container.textContent).toContain('Test the connection from Price point')
    expect(standard.container.textContent).not.toContain('Depends on:')
    standard.unmount()

    setStore({ results: { status: 'complete', report: {} }, viewMode: 'expert' })
    const detailed = renderOutcome()
    expect(detailed.container.textContent).toContain('Depends on:')
    expect(detailed.container.textContent).toContain('Price point')
  })

  it('(d) popover chips unchanged', () => {
    const { container } = renderOutcome()
    const popover = container.querySelector('[data-testid="hover-popover"]') as HTMLElement
    for (const chip of chipsOf(outcomeReq('popover', false))) expect(popover.textContent).toContain(chip.label)
  })

  it('(d) Detailed unchanged: the detailed chip row inline, and no icon', () => {
    setStore({ viewMode: 'expert' })
    const { container } = renderOutcome()
    const card = cardSurface(container)
    for (const chip of chipsOf(outcomeReq('detailed', false))) expect(card.textContent).toContain(chip.label)
    expect(iconsOn(card, OUTCOME_ID)).toHaveLength(0)
  })
})

// ─── Goal ───────────────────────────────────────────────────────────────────

const GOAL_ID = 'goal-1'
const renderGoal = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} id={GOAL_ID} type="goal" data={{ label: 'Grow ARR to 10m', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
const goalCardReq: NodeCoachingRequest = { kind: 'goal', surface: 'card', state: { achievementIsCritical: false }, context: {} }

describe('Goal card', () => {
  it.each(['idle', 'complete'] as const)('(a)(b) %s: one icon carrying the first card question; no chip row at rest', (status) => {
    setStore({ results: { status, report: status === 'complete' ? {} : null } })
    const { container } = renderGoal()
    assertOneIconNoChips(container, GOAL_ID, chipsOf(goalCardReq))
  })

  it('(c) click asks through requestAsk with this node in context', () => {
    const { container } = renderGoal()
    assertClickAsks(container, GOAL_ID, chipsOf(goalCardReq)[0])
  })

  it('(d) no target: the ruled wording "Target not captured" still renders', () => {
    renderGoal()
    expect(screen.getByTestId('goal-node-no-target-chip').textContent).toBe(GOAL_NO_TARGET_STATE)
  })

  it('(d) a set target keeps its edit route exactly as today', () => {
    renderGoal({ goal_threshold_raw: 15, goal_threshold_unit: '%' })
    expect(screen.getByTestId('goal-target-route')).toBeDefined()
  })

  it('(d) Detailed unchanged: the card question stays a chip there, and no icon', () => {
    setStore({ viewMode: 'expert' })
    const { container } = renderGoal()
    const card = cardSurface(container)
    expect(card.textContent).toContain(chipsOf(goalCardReq)[0].label)
    expect(iconsOn(card, GOAL_ID)).toHaveLength(0)
  })

  describe('stale prior-run figure (Ruling 3): stays visible, prefixed "Last run · "', () => {
    const withFigure = () => {
      setStore({ results: { status: 'complete', report: {} } })
      vi.mocked(useNodeDisplayMetadata).mockReturnValue({
        ...DISPLAY_DEFAULTS, achievementProbability: 0.42, isResultsMode: true,
      } as any)
    }

    it('model changed since the run: the figure is still shown, prefixed', () => {
      withFigure()
      vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'changed' } as any)
      const { container } = renderGoal({ goal_threshold_raw: 15, goal_threshold_unit: '%' })
      expect(container.textContent).toContain('Last run · 42% chance of reaching target')
    })

    it('CONTROL — a current run carries no prefix', () => {
      withFigure()
      const { container } = renderGoal({ goal_threshold_raw: 15, goal_threshold_unit: '%' })
      expect(container.textContent).toContain('42% chance of reaching target')
      expect(container.textContent).not.toContain('Last run')
    })
  })
})

// ─── Question (DecisionNode) ────────────────────────────────────────────────

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]
const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} id={DECISION_ID} type="decision" data={{ label: 'Should we hire?', type: 'decision' }} />
    </ReactFlowProvider>,
  )
const decisionReq = (surface: 'preAnalysis' | 'postAnalysis'): NodeCoachingRequest => ({
  kind: 'decision', surface,
  // The fixture has no goal target, so `showRunAnalysis` is false — the state
  // in which the pre-analysis row carries BOTH invitations.
  state: { showRunAnalysis: false },
  context: { optionCount: 2 },
})
const STABLE_REPORT = { robustness: { display_verdict: 'moderate', display_verdict_reason: 'Close call.' } }

describe('Question card (DecisionNode)', () => {
  beforeEach(() => setStore({ nodes: [decisionNode, ...optionNodes], edges: optionEdges }))

  it('(a)(b) pre-analysis: one icon carrying the first invitation; "Explore more options" / "What could go wrong?" are off the card', () => {
    const chips = chipsOf(decisionReq('preAnalysis'))
    expect(chips.length, 'fixture must carry both invitations').toBe(2)
    const { container } = renderDecision()
    assertOneIconNoChips(container, DECISION_ID, chips)
  })

  it('(a)(b) post-analysis Standard WITH stability: one icon; the post chips are not on the card', () => {
    setStore({ nodes: [decisionNode, ...optionNodes], edges: optionEdges, results: { status: 'complete', report: STABLE_REPORT } })
    const { container } = renderDecision()
    assertOneIconNoChips(container, DECISION_ID, chipsOf(decisionReq('postAnalysis')))
  })

  it('(c) click asks through requestAsk with this node in context', () => {
    const { container } = renderDecision()
    assertClickAsks(container, DECISION_ID, chipsOf(decisionReq('preAnalysis'))[0])
  })

  it('(d) the option count is still on the card', () => {
    renderDecision()
    expect(screen.getByTestId('decision-node-option-count').textContent).toBe(composeOptionCountLine(2))
  })

  it('(d) the top gap stays ONE line, with its full text recoverable', () => {
    const longLabel = 'Platform Engineer Headcount Added Over The Next Two Financial Years'
    setStore({
      nodes: [decisionNode, ...optionNodes, { id: 'f1', type: 'factor', data: { type: 'factor', label: longLabel, category: 'controllable' } }],
      edges: optionEdges,
    })
    renderDecision()
    const gap = screen.getByTestId('decision-node-top-gap')
    expect(gap.textContent).toMatch(/^Top gap: estimate /)
    expect(gap.className).toContain('line-clamp-1')
    expect(gap.getAttribute('title')).toBe(`Top gap: estimate ${longLabel}`)
  })

  it('(d) Standard post-analysis: the post chips stay reachable in the hover, exactly once', () => {
    setStore({ nodes: [decisionNode, ...optionNodes], edges: optionEdges, results: { status: 'complete', report: STABLE_REPORT } })
    const { container } = renderDecision()
    const popover = container.querySelector('[data-testid="hover-popover"]') as HTMLElement
    for (const chip of chipsOf(decisionReq('postAnalysis'))) {
      expect(screen.getAllByText(chip.label)).toHaveLength(1)
      expect(popover.textContent).toContain(chip.label)
    }
  })

  it('(d) Detailed unchanged: the invitations stay chips there, and no icon', () => {
    setStore({ nodes: [decisionNode, ...optionNodes], edges: optionEdges, viewMode: 'expert' })
    const { container } = renderDecision()
    const card = cardSurface(container)
    for (const chip of chipsOf(decisionReq('preAnalysis'))) expect(card.textContent).toContain(chip.label)
    expect(iconsOn(card, DECISION_ID)).toHaveLength(0)
  })
})
