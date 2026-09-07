/**
 * THE CANVAS STOPS NAMING A LEADER THE PRODUCER REFUSED TO NAME — W1-e (a).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE answered a correction with `leader_claim { permitted: false,
 * withheld_reason: 'separation_unavailable' }` and `requires_rerun: true`, and
 * the option card went on wearing its `Leading option` pill. The refusal was
 * rendered in the conversation and vanished on reload; the unsafe designation
 * outlived it. The honest half was transient and the unsafe half was durable.
 *
 * This suite drives the CARD, because the card is where the claim is made. It
 * binds by IDENTITY — `leading-option-pill-${id}`, not "some element reading
 * 49%" — so it cannot pass on a different element than the one under test
 * (CLAUDE.md trap 19).
 *
 * ⚠ WHAT IT DOES NOT CLAIM (trap 3). jsdom performs no layout. Nothing here is
 * a statement about pixels, position or visibility-in-viewport; these are
 * assertions about what is MOUNTED.
 *
 * ⚠ THE HOOK IS NOT MOCKED — the store is driven and `useNodeDisplayMetadata`
 * derives from it, so the fixture cannot hand the card a state the real
 * producer chain cannot reach (trap 16-inverse). The store shape mirrors
 * `OptionNode.leadingPillCornerStack.spec.tsx`'s, deliberately, so both suites
 * drive one shape rather than two restatements of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

import { useCanvasStore } from '../../store'

const NODE_ID = 'option-1'
const SIBLING_ID = 'option-2'

/** The wire's own words, spelled verbatim rather than through a helper, so a
 *  RED here is about BEHAVIOUR and never about a missing export. */
function withPermission(report: object, permission: unknown) {
  return { ...report, producer_leader_permission: permission }
}

/** The SHIPPED permitting report — the state the harm was witnessed over. */
function permittedReport() {
  return {
    option_probabilities: {
      [NODE_ID]: { win_probability: 0.72 },
      [SIBLING_ID]: { win_probability: 0.23 },
    },
    robustness: { recommended_option_id: NODE_ID, near_tie: { is_tie: false, top_option_id: NODE_ID } },
  }
}

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  optionNumbering: { [NODE_ID]: 1, [SIBLING_ID]: 2 },
  editedSinceRunNodeIds: new Set<string>(),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  lodRung: 'full',
  viewMode: 'expert',
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
})

const baseProps = {
  id: NODE_ID,
  type: 'option',
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

function renderOption(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState(report)),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OptionNode — a withheld leader claim removes the designation', () => {
  it('PRECONDITION: with the producer silent, this card wears the pill', () => {
    // Without this, every absence assertion below could pass by testing
    // nothing (CLAUDE.md trap 13 — an absence probe needs a positive control).
    renderOption(permittedReport())
    expect(screen.getByTestId(`leading-option-pill-${NODE_ID}`)).toBeInTheDocument()
  })

  it('DEFECT SIGNATURE: `leader_claim.permitted:false` removes the `Leading option` pill', () => {
    renderOption(
      withPermission(permittedReport(), {
        permitted: false,
        withheld_reason: 'separation_unavailable',
      }),
    )
    expect(screen.queryByTestId(`leading-option-pill-${NODE_ID}`)).toBeNull()
    // Bound by identity AND by text, because the text is the claim the user
    // reads and the test id is the element the fix removes.
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  it('CONTRAST CONTROL: `permitted:true` leaves the pill exactly where it was', () => {
    renderOption(withPermission(permittedReport(), { permitted: true }))
    expect(screen.getByTestId(`leading-option-pill-${NODE_ID}`)).toBeInTheDocument()
  })

  it('THE DATA IS NOT DELETED: the option keeps its own win figure', () => {
    // ⭐ SCOPE, STATED RATHER THAN ASSUMED. CEE withholds the CLAIM and ships
    // the DATA — `decisionVerdict.ts`'s own header records this ("the DATA is
    // not withheld, only the CLAIM"). Blanking the per-option win share would
    // delete the user's result and contradict the producer's own withheld
    // projection. What must go is the DESIGNATION, and only that.
    renderOption(withPermission(permittedReport(), { permitted: false }))
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('72%')
  })

  it('THE ORDINAL IS NOT A RANK AND IS NOT WITHDRAWN', () => {
    // ⚠ PREMISE CORRECTION, derived at `canvas/store.ts:5019-5038`
    // (`registerOptionNumbering`). `option-stable-number-*` is NOT a
    // probability rank: the store orders ids by CANVAS POSITION and its own
    // comment records that the frozen-probability-rank reading was the defect
    // Paul had removed on 31 Aug 2026 ("the store owns ORDER; callers own
    // MEMBERSHIP"). Withdrawing it on a withheld claim would delete a
    // navigational identifier and re-open a ruling, so this suite PINS that it
    // survives rather than silently leaving the question open.
    renderOption(withPermission(permittedReport(), { permitted: false }))
    expect(screen.getByTestId(`option-stable-number-${NODE_ID}`)).toBeInTheDocument()
  })
})
