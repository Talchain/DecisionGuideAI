/**
 * ⭐⭐⭐ THE OPTION CARD NAMED THE DESTINATION AND OFFERED NO WAY THERE.
 *
 * Measured on served `1f77130d`, canonical pricing board, geometry-free
 * destination probe (`locator.click()` per node — no coordinate computed
 * anywhere, because five consecutive false FAILs on edges came from a bezier's
 * bounding-box centre not being on the path), `factorContrast=true`:
 *
 *     KIND option 0/4 reach a live editor
 *
 * while the card's own line read *"3 factor targets. Open the inspector to see
 * which ones."* — rendered as a `<p>`.
 *
 * ⛔ AND THE CARRIER HERE IS REAL, WHICH IS WHY THE SENTENCE MAY STRENGTHEN.
 * `option` IS in `AUTHORITY_OWNING_PANELS`, so `OptionPanel` is not behind the
 * blanket `<fieldset disabled>`, and `proposeOptionIntervention` carries
 * `option_intervention_edit` — one of only seven model-changing wire verbs.
 * The stronger wording is COMPOSED from `modelOptionIntervention`, so a
 * regression returns it to *see*, which stays true.
 *
 * CLAIM SCOPE (trap 3): jsdom pins the control and the strings, never layout,
 * visibility, or that the inspector's own editor is operable. That half is
 * `useOptionInterventionCommit`'s and the browser witness's.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  OptionNode,
  OPTION_TARGETS_ROUTE_IS_LIVE,
  optionTargetsChannels,
} from '../OptionNode'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../mutations/mutationAuthority'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const openNodeInspector = vi.fn((_nodeId: string) => true)
vi.mock('../shared/openNodeInspector', () => ({
  OPEN_FULL_INSPECTOR_EVENT: 'open-full-inspector',
  openNodeInspector: (...args: unknown[]) => openNodeInspector(...(args as [string])),
}))

const OPTION_ID = 'opt_hybrid'

/**
 * The branch the card-copy census pins: interventions present, and NO observed
 * values on the factors, so `structuredDeltas` is empty and the COUNT line is
 * what renders. Modelled on `cardCopyCensus.canvas.spec.tsx`'s own fixture
 * rather than invented, so this exercises the same path the census walks.
 */
const NODES = [
  { id: OPTION_ID, type: 'option', data: { label: 'Hybrid Platform Fee Plus Usage', type: 'option' } },
  { id: 'fac_usage_exposure', type: 'factor', data: { label: 'Usage-Based Pricing Exposure', type: 'factor' } },
  { id: 'fac_top_account', type: 'factor', data: { label: 'Top Account Revenue Concentration', type: 'factor' } },
]
const EDGES = [
  { id: 'e1', source: OPTION_ID, target: 'fac_usage_exposure' },
  { id: 'e2', source: OPTION_ID, target: 'fac_top_account' },
]
const CEE = {
  options: [{ id: OPTION_ID, interventions: { fac_usage_exposure: 0.6, fac_top_account: 0.3 } }],
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: OPTION_ID,
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

function renderCard() {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  } as never)
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: NODES,
      edges: EDGES,
      ceeAnalysisReady: CEE,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: 0.6,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode: 'expert',
      lodRung: 'full',
    } as never),
  )
  const { container } = render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={NODES[0].data} />
    </ReactFlowProvider>,
  )
  return container.querySelector(`[data-testid="option-change-count-${OPTION_ID}"]`)
}

describe('the factor-targets line is a route, not a sentence about one', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openNodeInspector.mockClear()
  })

  it('renders as a real control', () => {
    const line = renderCard()
    expect(line, 'the change-count line must still render').not.toBeNull()
    expect(line?.tagName.toLowerCase()).toBe('button')
  })

  it('still states the count — the contrast control', () => {
    // If this REDs the change altered what the card ASSERTS, not what it
    // offers. `2` because the fixture carries two interventions.
    expect(renderCard()?.textContent ?? '').toContain('2 factor targets')
  })

  it('opens THIS option, bound by id and not by "a call happened"', () => {
    ;(renderCard() as HTMLButtonElement).click()
    expect(openNodeInspector).toHaveBeenCalledWith(OPTION_ID)
  })

  it('keeps both carriers — the glance count and the full sentence', () => {
    const line = renderCard()
    const { short, full } = optionTargetsChannels({ count: 2 })
    expect(line?.querySelector('[aria-hidden="true"]')?.textContent).toBe(short)
    expect(line?.textContent).toContain(full)
    expect(line?.getAttribute('title')).toBe(full)
  })
})

describe('the sentence is composed from the authority, not asserted', () => {
  it('says the targets can be CHANGED while the carrier is live', () => {
    expect(optionTargetsChannels({ count: 3, routeIsLive: true }).full).toBe(
      '3 factor targets. Open the inspector to change them.',
    )
  })

  it('falls back to the weaker, still-true sentence when it is not', () => {
    expect(optionTargetsChannels({ count: 3, routeIsLive: false }).full).toBe(
      '3 factor targets. Open the inspector to see which ones.',
    )
  })

  it('singularises the count in both branches', () => {
    for (const live of [true, false]) {
      expect(optionTargetsChannels({ count: 1, routeIsLive: live }).short).toBe('1 factor target')
    }
  })

  /**
   * ⛔ THE ONE THAT ACTUALLY REDS ON A REGRESSED KEY. The equality check below
   * compares the default against the derivation and is GREEN WHICHEVER WAY THE
   * KEY FALLS — a tautology, and the exact shape that let a mutant regressing
   * `modelGoalMinimumTarget` survive its spec once. This asserts what the CARD
   * RENDERS TODAY against the live branch, so flipping
   * `modelOptionIntervention` to `'disabled'` REDs here rather than passing
   * quietly with a weaker sentence on screen.
   */
  it('the card renders the LIVE sentence while the carrier is live', () => {
    expect(renderCard()?.getAttribute('title')).toBe(
      optionTargetsChannels({ count: 2, routeIsLive: true }).full,
    )
  })

  it('the production default IS the derivation, not a second copy of it', () => {
    expect(OPTION_TARGETS_ROUTE_IS_LIVE).toBe(
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelOptionIntervention),
    )
    expect(optionTargetsChannels({ count: 3 }).full).toBe(
      optionTargetsChannels({ count: 3, routeIsLive: OPTION_TARGETS_ROUTE_IS_LIVE }).full,
    )
  })
})
