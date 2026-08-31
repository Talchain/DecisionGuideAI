/**
 * ⭐ THE COUNTER-CASE DOOR — the reasoning frontier's one invitation on the
 * option the numbers put in front.
 *
 * Everything else on this canvas helps a team interrogate the model they built.
 * Nothing helps them notice what they never put in it — and the moment a team
 * is most likely to stop looking is the moment one option is ahead. This chip
 * asks what would have to be true for that option to be the wrong choice.
 *
 * ── WHAT THESE TESTS ARE FOR ──
 *
 * Two properties, and the second is the one that could ship a trust defect:
 *
 *  1. It is an INVITATION, not a finding. It must assert nothing about the
 *     model — no "too similar", no "not enough", no verdict of any kind. A
 *     question presupposes nothing and therefore needs no producer behind it,
 *     which is the whole reason this affordance can exist at all.
 *
 *  2. It NAMES THE LEADER, so it may only appear when the product is ENTITLED
 *     to name one. On a withheld turn no option is the leader; a chip saying
 *     "what would make X the wrong choice" would then be a leader claim in
 *     disguise — the same inverse-form leak that put "Behind:" on every option
 *     including the front-runner (ROADMAP 1.239). The entitlement is INHERITED
 *     from `isRecommended` rather than re-derived, so the withheld case below
 *     is testing that inheritance actually holds, not a second predicate.
 *
 * CLAUDE.md trap 3: these assert presence/absence of TEXT. jsdom cannot prove
 * visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import {
  LEADER_ID,
  RUNNER_UP_ID,
  PERMITTED_REPORT,
  WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const LEADER_LABEL = 'Standardise on MacBook Pro'
const RUNNER_UP_LABEL = 'Standardise on Dell XPS'

const OPTION_NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
]

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: OPTION_NODES,
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  // Expert, because option chips render inline only in the Detailed view —
  // in Standard they live in a hover popover. That is a REACHABILITY problem
  // this spec does not paper over: it is the same post-analysis visibility
  // question raised on #1060, it applies to every option chip and not just
  // this one, and it is owned separately. What is asserted here is that the
  // chip exists and is correctly gated, NOT that a Standard-view user can
  // reach it.
  viewMode: 'expert',
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const resultsMetadata = (winRate: number) =>
  ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate, isResultsMode: true,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  }) as never

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

function renderNode(id: string, label: string) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={id} data={{ label, type: 'option' }} />
    </ReactFlowProvider>,
  )
}

function withStore(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(report) as never),
  )
}

const COUNTER_CASE_LABEL = 'What would make this wrong?'

describe('the counter-case door on the leading option', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.62))
  })

  it('offers the counter-case on the option the numbers put in front', () => {
    withStore(PERMITTED_REPORT)
    renderNode(LEADER_ID, LEADER_LABEL)
    expect(screen.getByText(COUNTER_CASE_LABEL)).toBeTruthy()
  })

  it('⭐ WITHHELD: no counter-case when the product may not name a leader', () => {
    // The trust assertion. On a withheld turn `verdict.hasLeadingOption` is
    // false, so no option is `isRecommended` — and a chip that names an option
    // as the one to argue against would designate a leader the producer
    // declined to name. Inverse-form leader claim, exactly as "Behind:" was.
    withStore(WITHHELD_REPORT)
    renderNode(LEADER_ID, LEADER_LABEL)
    expect(screen.queryByText(COUNTER_CASE_LABEL)).toBeNull()
  })

  it('CONTRAST CONTROL: the withheld fixture still renders the node', () => {
    // Without this, the absence above passes if the component simply failed to
    // render — an absence assertion with nothing proving it can see a presence
    // is vacuous (trap 13).
    withStore(WITHHELD_REPORT)
    renderNode(LEADER_ID, LEADER_LABEL)
    expect(screen.getByText(LEADER_LABEL)).toBeTruthy()
  })

  it('does not offer it on a non-leading option', () => {
    withStore(PERMITTED_REPORT)
    renderNode(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(screen.queryByText(COUNTER_CASE_LABEL)).toBeNull()
  })

  it('asks about THIS option by name — not a generic question', () => {
    // Paul's furniture ruling: copy identical on every card is furniture, not
    // information. Bound by IDENTITY (the option's own label) rather than by a
    // value predicate another chip could satisfy (trap 19).
    withStore(PERMITTED_REPORT)
    const { container } = renderNode(LEADER_ID, LEADER_LABEL)
    const chip = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === COUNTER_CASE_LABEL)
    expect(chip).toBeTruthy()
    // The sent message is what carries the model-awareness, and it never
    // renders — #1061 shipped a hardcoded "a third option" past a guard that
    // scanned rendered text for exactly this reason.
    expect(container.innerHTML).toContain(LEADER_LABEL)
  })

  it('asserts nothing about the quality of the model', () => {
    // The line this affordance stands on. Naming a deficiency is a reasoning
    // judgement, it needs the science behind it, and it belongs to the
    // producer. A question presupposes nothing.
    withStore(PERMITTED_REPORT)
    const { container } = renderNode(LEADER_ID, LEADER_LABEL)
    const JUDGEMENT = /\b(too similar|too few|not enough|weak|incomplete|flawed|you should)\b/i
    expect(container.textContent ?? '').not.toMatch(JUDGEMENT)
  })
})
