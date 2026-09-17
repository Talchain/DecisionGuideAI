/**
 * THE BOARD MUST SAY WHICH OPTIONS THE RUN IS LEAVING OUT.
 *
 * ⭐ THE GAP THIS CLOSES, MEASURED RATHER THAN ARGUED. CEE stamps
 * `waived_by_exclusion` on the served path — across 32 real staging turn
 * responses it is present on 30/32, with 14 `true` and 7 `false`, so it
 * discriminates, and 14/14 of the true entries carry a real `option_id`. This
 * repo already PARSED it (`readinessStore.ts:1113`) and already USED it, to
 * decide not to block the run (`composeBlockedReason.ts:551`).
 *
 * What it never did was show anyone. The user was told in prose in the results
 * dock — *"Analysis can run, leaving out one option you have not set values
 * for"* — while the option sat on the canvas looking exactly like the options
 * that ARE included. The fact arrived, was acted on, and was invisible on the
 * surface the decision is actually read from.
 *
 * ⛔ THE FACT IS CEE'S, AND THIS COMPONENT MUST NEVER RE-DERIVE IT. *"Not
 * connected"*, *"no values set"* and *"excluded from this calculation"* are
 * three different facts and an option can be any combination of them. The
 * binding asserted here is that the pill tracks the PRODUCER'S STAMP — so the
 * negative cases below are not padding, they are the point.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null, stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { OptionNode } from '../OptionNode'
import { FactorNode } from '../FactorNode'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0,
  deletable: true, selectable: true, draggable: true,
}

const OPTION_ID = 'opt_launch_subscription'
/** CEE's own sentence, as it arrives on the wire. Never composed here. */
const CEE_MESSAGE = 'Set values for Launch Our Own Subscription Offering, or the run will leave it out.'

type Issue = Record<string, unknown>

function setReadiness(issues: Issue[] | undefined, stale = false) {
  useReadinessStore.setState({
    readiness: (issues === undefined ? null : { readiness_issues: issues }) as never,
    stale,
  })
}

function renderNode(kind: 'option' | 'factor', id: string) {
  const data = { label: 'Launch Our Own Subscription Offering', type: kind }
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [{ id, type: kind, data }],
      edges: [],
      // Pre-run, nothing assessed — so `isIncomplete` is FALSE and cannot be
      // what any pill below is reacting to.
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(), dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null, goalConstraints: [],
      setHoveredOption: vi.fn(), viewMode: 'expert',
    } as never),
  )
  const Node = kind === 'option' ? OptionNode : FactorNode
  return render(
    <ReactFlowProvider>
      <Node {...(baseProps as any)} type={kind} id={id} data={data as any} />
    </ReactFlowProvider>,
  )
}

const pill = () => screen.queryByTestId('excluded-from-analysis-pill')

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
  setReadiness(undefined)
})

describe('an excluded option says so on the board', () => {
  it('marks the option CEE stamped, and carries CEE\'s own sentence', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    const el = pill()
    expect(el).toBeTruthy()
    expect(el!.textContent).toBe('Not in this analysis')
    // The REASON is the producer's, not this component's.
    expect(el!.getAttribute('title')).toBe(CEE_MESSAGE)
  })

  it('still marks it when CEE sent no sentence — excluded is excluded', () => {
    setReadiness([{ option_id: OPTION_ID, waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    expect(pill()).toBeTruthy()
    expect(pill()!.getAttribute('title')).toBe('The analysis will run without this option')
  })

  /**
   * ⛔ THE PILL IS NOT THE "NEEDS INPUT" PILL WEARING NEW WORDS. They are
   * separately identified, so a spec about one can never pass on the other.
   */
  it('does not answer to the needs-input identity', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })
})

describe('⛔ it tracks the producer\'s stamp, and nothing else', () => {
  it('says nothing when readiness has not arrived', () => {
    setReadiness(undefined)
    renderNode('option', OPTION_ID)
    expect(pill()).toBeNull()
  })

  /** The discriminating case: the SAME option, named by the SAME issue, with
   *  the flag false. 7 of 21 measured entries are exactly this. */
  it('says nothing when CEE stamped the option NOT waived', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: false }])
    renderNode('option', OPTION_ID)
    expect(pill()).toBeNull()
  })

  it('says nothing about an option the issue does not name', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: 'opt_someone_else', waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    expect(pill()).toBeNull()
  })

  /** An exclusion that names no option cannot mark one. Marking an arbitrary
   *  node from an unnamed entry is the failure this guards. */
  it('says nothing when the exclusion names no option at all', () => {
    setReadiness([{ message: CEE_MESSAGE, waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    expect(pill()).toBeNull()
  })

  /** Bound to the node TYPE, not just the id space — a factor that collided on
   *  id must not inherit an option's exclusion. */
  /**
   * ⛔ A STALE VERDICT MAY NOT MARK A NODE — found by adversarial self-review
   * before merge, not by a reviewer.
   *
   * `stale` means the model has moved on from the verdict on screen. The
   * reachable harm is the user's own fix being ignored: they see the marker,
   * set values on that option, and it keeps saying excluded until readiness
   * refetches — the product telling them their correction did not count.
   */
  it('says nothing when the verdict is stale, however emphatic the stamp', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }], true)
    renderNode('option', OPTION_ID)
    expect(pill()).toBeNull()
  })

  it('CONTRAST: the identical verdict marks once it is current again', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }], false)
    renderNode('option', OPTION_ID)
    expect(pill()).toBeTruthy()
  })

  it('never marks a factor, even on an id collision', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }])
    renderNode('factor', OPTION_ID)
    expect(pill()).toBeNull()
  })

  /** CONTRAST CONTROL for the four zeroes above: the identical setup with the
   *  stamp restored must MARK, or every absence here is a blind probe. */
  it('CONTRAST: the same render marks once the stamp is present', () => {
    setReadiness([{ message: CEE_MESSAGE, option_id: OPTION_ID, waived_by_exclusion: true }])
    renderNode('option', OPTION_ID)
    expect(pill()).toBeTruthy()
  })
})
