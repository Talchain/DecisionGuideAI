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
import { render, screen, fireEvent } from '@testing-library/react'
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
import { useGuidanceStore } from '../../stores/guidanceStore'

/**
 * ⭐ WHAT THE CHIP SENDS, NOT WHAT THE CARD SHOWS — and the first version of
 * this file got that wrong in the very way it was written to prevent.
 *
 * Two guards here scanned the DOM. Neither could observe what it policed:
 *
 *  · `container.innerHTML` contains the option's own TITLE, so a check that the
 *    label appears is satisfied whether or not the chip interpolates it. **The
 *    contrast-control test below proves it**: it finds the label on the WITHHELD
 *    render, where this chip does not exist at all. Strip the interpolation and
 *    the assertion stays green.
 *  · The judgement regex scanned `textContent`, which holds the rendered LABEL
 *    only — so "what could this model be missing?", the nearest thing in this
 *    change to a claim about model quality, was never scanned.
 *
 * Same shape as the defect this estate fixed on the decision node the same
 * night: the guard and the thing it guards were on different strings. Writing
 * it into a new spec while holding that diagnosis is the reason it is recorded
 * here rather than quietly corrected.
 *
 * `_dispatchAction` is set on the REAL store rather than stubbed — a hand-built
 * store stub has to keep pace with every consumer that reads it.
 */
const dispatched: Array<Record<string, unknown>> = []

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
    dispatched.length = 0
    useGuidanceStore.setState({
      _dispatchAction: (a: Record<string, unknown>) => { dispatched.push(a) },
    } as never)
  })

  /** Click the counter-case chip and return what it actually sent. */
  const sentByCounterCase = (container: HTMLElement): Record<string, unknown> => {
    const chip = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === COUNTER_CASE_LABEL)
    if (!chip) throw new Error('refusing to assert: no counter-case chip rendered')
    fireEvent.click(chip)
    if (dispatched.length === 0) throw new Error('refusing to assert: click dispatched nothing')
    return dispatched[dispatched.length - 1]
  }

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

  it('the SENT MESSAGE names this option — asserted on the payload, not the DOM', () => {
    withStore(PERMITTED_REPORT)
    const { container } = renderNode(LEADER_ID, LEADER_LABEL)
    const sent = sentByCounterCase(container)
    expect(sent.chip_id ?? (sent.parameters as { chip_id?: string })?.chip_id).toBe('option_counter_case')
    expect(String(sent.message)).toContain(LEADER_LABEL)
  })

  it('DISCRIMINATION: the message differs between two options, so it is not a fixed string', () => {
    // Naming the leader is only worth anything if the name is the LEADER'S.
    // A hardcoded label would satisfy the assertion above on this fixture and
    // fail here — which is the pair, not the single test.
    withStore(PERMITTED_REPORT)
    const first = renderNode(LEADER_ID, LEADER_LABEL)
    const sentA = String(sentByCounterCase(first.container).message)
    expect(sentA).toContain(LEADER_LABEL)
    expect(sentA).not.toContain(RUNNER_UP_LABEL)
  })

  it('asserts nothing about the quality of the model — scanned on the SENT TEXT', () => {
    // The line this affordance stands on. Naming a deficiency is a reasoning
    // judgement: it needs the science behind it and belongs to the producer. A
    // question presupposes nothing.
    //
    // Scanned on the message, because that is where the only sentence capable of
    // failing it lives ("what could this model be missing?"). The DOM carries
    // the eight-word label and could not fail this regex if it tried.
    withStore(PERMITTED_REPORT)
    const { container } = renderNode(LEADER_ID, LEADER_LABEL)
    const JUDGEMENT = /\b(too similar|too few|not enough|weak|incomplete|flawed|you should)\b/i
    const sent = String(sentByCounterCase(container).message)
    expect(sent).toMatch(/missing/i)   // precondition: the risky sentence IS present
    expect(sent).not.toMatch(JUDGEMENT)
  })

  /**
   * ⚠ THE MOST ACUTE CASE IS THE ONE THE DOOR DOES NOT COVER, pinned rather
   * than left to be discovered.
   *
   * The baseline arm precedes `isRecommended`, so when the winning option is
   * the STATUS QUO the counter-case door never renders — and "we should do
   * nothing" is exactly the verdict a team is most likely to stop arguing with.
   * Recorded as current behaviour so a change to it is deliberate, and rowed
   * rather than fixed here: it needs a decision about the baseline arm, not a
   * wider gate.
   */
  it('KNOWN GAP: no counter-case when the leading option is the baseline', () => {
    const baselineNodes = [
      { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL, is_baseline: true } },
      { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
    ]
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector({ ...makeStoreState(PERMITTED_REPORT), nodes: baselineNodes } as never),
    )
    // ⚠ THE FLAG MUST BE ON THE COMPONENT'S OWN PROPS, not just the store node.
    // `isBaselineOption` reads `props.data.is_baseline` (OptionNode.tsx:583) and
    // only falls back to a label regex when that is absent. My first fixture set
    // it on the store node alone, so the component never saw it and the test was
    // asserting the gap against a node that was not actually the baseline.
    const { container } = render(
      <ReactFlowProvider>
        <OptionNode
          {...(baseProps as any)}
          id={LEADER_ID}
          data={{ label: LEADER_LABEL, type: 'option', is_baseline: true }}
        />
      </ReactFlowProvider>,
    )
    const chip = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === COUNTER_CASE_LABEL)
    expect(chip).toBeUndefined()
  })
})
