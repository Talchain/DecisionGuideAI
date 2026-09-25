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
 *
 * ⭐ LOCKED CANVAS DESIGN (23 Sep 2026; spec §4, ED 11:52Z point 4, ED 02:31Z
 * D2). The "N factor targets" line (`option-change-count-<id>`) is REMOVED from
 * the face. The routes are now (1) a persistent rail PENCIL
 * (`option-edit-targets-<id>`, accessible name = the SAME composed sentence,
 * "N factor targets. Open the inspector to change them.") and (2) `+N more`
 * (`option-change-more-<id>`) under the ≤3 change rows (Paul 25 Sep; was ≤2). Both open the inspector
 * via `openNodeInspector`. Every test below keeps its claim and is re-pointed
 * to those carriers; each also asserts the old line stays gone.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { optionCardRows } from './__helpers__/optionPreview'
import { ReactFlowProvider } from '@xyflow/react'
import {
  OptionNode,
  OPTION_TARGETS_ROUTE_IS_LIVE,
  optionTargetsChannels,
  optionTargetsLineShows,
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
  // Carry no target in the default fixture; the third and fourth targets for
  // the `+N more` case (Paul 25 Sep: ≤3 rows + `+N more`; it was ≤2).
  { id: 'fac_churn', type: 'factor', data: { label: 'Churn', type: 'factor' } },
  { id: 'fac_margin', type: 'factor', data: { label: 'Gross margin', type: 'factor' } },
]
const EDGES = [
  { id: 'e1', source: OPTION_ID, target: 'fac_usage_exposure' },
  { id: 'e2', source: OPTION_ID, target: 'fac_top_account' },
]
const CEE = {
  options: [{ id: OPTION_ID, interventions: { fac_usage_exposure: 0.6, fac_top_account: 0.3 } }],
}
/** Four targets: three rows on the card (Paul 25 Sep), one counted by `+1 more`. */
const CEE_FOUR = {
  options: [{ id: OPTION_ID, interventions: { fac_usage_exposure: 0.6, fac_top_account: 0.3, fac_churn: 0.1, fac_margin: 0.4 } }],
}
/** No targets at all — the contrast for the pencil's two labels. */
const CEE_NONE = { options: [{ id: OPTION_ID, interventions: {} }] }

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

/**
 * Returns the route carrier. Locked Canvas design (23 Sep 2026): that is the
 * rail pencil `option-edit-targets-<id>` — the "N factor targets" line it
 * returned before is gone from the face (see `oldCountLine`).
 */
function renderCard(viewMode: 'standard' | 'expert' = 'expert', dataOverride?: Record<string, unknown>, resultsStatus: string = 'idle', cee: unknown = CEE) {
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
      ceeAnalysisReady: cee,
      results: { status: resultsStatus, report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: 0.6,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode,
      lodRung: 'full',
    } as never),
  )
  const { container } = render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ ...NODES[0].data, ...(dataOverride ?? {}) }} />
    </ReactFlowProvider>,
  )
  // ⚠ Positive control: the card mounted, so a null below is an absence.
  expect(container.querySelector('[data-testid="node-title"]'), 'the card did not mount').not.toBeNull()
  return container.querySelector(`[data-testid="option-edit-targets-${OPTION_ID}"]`)
}
/** The REMOVED "N factor targets" line — asserted absent wherever the route is. */
const oldCountLine = () => document.querySelector(`[data-testid="option-change-count-${OPTION_ID}"]`)
const moreRoute = () => document.querySelector(`[data-testid="option-change-more-${OPTION_ID}"]`)

describe('the factor-targets line is a route, not a sentence about one', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openNodeInspector.mockClear()
  })

  it('renders as a real control', () => {
    const line = renderCard()
    // Locked Canvas design (23 Sep 2026; spec §4): the route is the rail pencil.
    expect(line, 'the targets route (rail pencil) must render').not.toBeNull()
    expect(line?.tagName.toLowerCase()).toBe('button')
    expect(oldCountLine(), 'the removed "N factor targets" line came back').toBeNull()
  })

  it('still states the count — the contrast control', () => {
    // If this REDs the change altered what the card ASSERTS, not what it
    // offers. `2` because the fixture carries two interventions.
    // Locked Canvas design (23 Sep 2026): the count now rides the pencil's
    // accessible name (the face shows the rows themselves).
    expect(renderCard()?.getAttribute('aria-label') ?? '').toContain('2 factor targets')
  })

  it('opens THIS option, bound by id and not by "a call happened"', () => {
    ;(renderCard() as HTMLButtonElement).click()
    expect(openNodeInspector).toHaveBeenCalledWith(OPTION_ID)
    // Locked Canvas design (23 Sep 2026): the SECOND route, `+N more`, opens
    // the same option — four targets, three rows, one counted.
    cleanup()
    openNodeInspector.mockClear()
    renderCard('expert', undefined, 'idle', CEE_FOUR)
    const more = moreRoute() as HTMLButtonElement | null
    expect(more, '`+N more` must render when a target is not shown').not.toBeNull()
    expect(more?.tagName.toLowerCase()).toBe('button')
    expect(more?.textContent).toBe('+1 more')
    more!.click()
    expect(openNodeInspector).toHaveBeenCalledTimes(1)
    expect(openNodeInspector).toHaveBeenCalledWith(OPTION_ID)
  })

  it('keeps both carriers — the glance count and the full sentence', () => {
    // Locked Canvas design (23 Sep 2026; ED 11:52Z point 4): the glance count
    // is now the change rows themselves plus `+N more`, with N from the ONE
    // total; the full sentence is the pencil's accessible name.
    const line = renderCard()
    const { full } = optionTargetsChannels({ count: 2 })
    expect(line?.getAttribute('aria-label')).toBe(full)
    const rows = document.querySelector(`[data-testid="option-change-rows-${OPTION_ID}"]`)
    expect(rows, 'the change rows must render').not.toBeNull()
    expect(rows!.querySelectorAll('dd').length).toBe(2)
    expect(document.querySelector(`[data-testid="option-change-row-${OPTION_ID}-fac_usage_exposure"]`)).not.toBeNull()
    expect(document.querySelector(`[data-testid="option-change-row-${OPTION_ID}-fac_top_account"]`)).not.toBeNull()
    // Two targets, two rows shown: nothing left to count.
    expect(moreRoute()).toBeNull()

    // Four targets: three rows + `+1 more`, whose name carries the full sentence
    // for the ONE total and says how many are not shown.
    cleanup()
    const four = renderCard('expert', undefined, 'idle', CEE_FOUR)
    const full4 = optionTargetsChannels({ count: 4 }).full
    expect(four?.getAttribute('aria-label')).toBe(full4)
    expect(document.querySelector(`[data-testid="option-change-rows-${OPTION_ID}"]`)!.querySelectorAll('dd').length).toBe(3)
    expect(moreRoute()?.textContent).toBe('+1 more')
    expect(moreRoute()?.getAttribute('aria-label')).toBe(`${full4} 1 more not shown on the card.`)
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
    // Locked Canvas design (23 Sep 2026): the pencil's accessible name carries
    // the sentence the removed line's `title` did.
    expect(renderCard()?.getAttribute('aria-label')).toBe(
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

/**
 * ⭐⭐⭐ THE BRANCH THE REAL BOARD TAKES — which the fixture above does not.
 *
 * The fixture above says so itself: *"NO observed values on the factors, so
 * `structuredDeltas` is empty and the COUNT line is what renders."* On the
 * canonical pricing board every option carries three interventions WITH
 * references, so the deltas DO render — and under the old gate
 * (`structuredDeltas.length === 0 && hasInterventions`) the route line did not.
 *
 * MEASURED, served `db758d83`, guest, affordance census over every `title` and
 * `aria-label` on each card (controls: a fabricated phrase matched nothing; the
 * status string "Edited since…" excluded by name and counted):
 *
 *     cardsWhoseONLYAffordanceIsRename = [ option:opt_full_switch,
 *       option:opt_hybrid, option:opt_new_logos, option:opt_status_quo, … ]
 *
 * ⛔ MUTANT PAIR. Restoring the fallback rule — `hasInterventions &&
 * !deltasRendered` — REDs the first case below and leaves the other three
 * green. Making the line unconditional REDs the last two and leaves the first
 * two green. Neither mutant survives.
 */
describe('the route line shows wherever a target exists, not only as a fallback', () => {
  it('SHOWS beside the deltas — the case the served board is in, and the old gate refused', () => {
    expect(optionTargetsLineShows({ hasInterventions: true, deltasRendered: true })).toBe(true)
  })

  it('REGRESSION GUARD — still shows in the fallback case the old gate covered', () => {
    expect(optionTargetsLineShows({ hasInterventions: true, deltasRendered: false })).toBe(true)
  })

  it('CONTRAST CONTROL — it is a route to targets, so no targets means no line', () => {
    expect(optionTargetsLineShows({ hasInterventions: false, deltasRendered: false })).toBe(false)
    expect(optionTargetsLineShows({ hasInterventions: false, deltasRendered: true })).toBe(false)
  })

  it('the CARD is gated by the predicate, not by a second copy of the rule', () => {
    // The fixture has interventions and no deltas; the predicate says show, and
    // the card must agree. If the card ever re-derives the rule inline, a change
    // to the predicate stops moving the card and this stops being evidence —
    // so the render and the predicate are asserted together.
    // Locked Canvas design (23 Sep 2026; spec §4 "a persistent pencil"): the
    // pencil renders for every non-baseline option; "targets exist" now decides
    // which SENTENCE it carries. ⚠ `optionTargetsLineShows` has no production
    // caller any more — the card reads `hasInterventions` directly (the same
    // rule) — so this pairs the predicate with the label it now selects.
    expect(optionTargetsLineShows({ hasInterventions: true, deltasRendered: false })).toBe(true)
    expect(renderCard()?.getAttribute('aria-label')).toBe(optionTargetsChannels({ count: 2 }).full)
    // CONTRAST — no targets: the predicate says no line, and the pencil offers
    // to SET targets instead of claiming any exist.
    cleanup()
    expect(optionTargetsLineShows({ hasInterventions: false, deltasRendered: false })).toBe(false)
    const none = renderCard('expert', undefined, 'idle', CEE_NONE)
    expect(none?.getAttribute('aria-label')).toBe('No factor targets yet. Open the inspector to set what this option changes.')
    expect(none?.getAttribute('aria-label')).not.toMatch(/\d+ factor targets?/)
  })
})

/**
 * ⭐⭐⭐ THE VIEW THE PRODUCT ACTUALLY OPENS IN.
 *
 * ⛔ MEASURED on served `b5f1867d` — the build containing #1871, which was
 * supposed to have fixed this:
 *
 *     [OPT] changeCountEls = 0      <- [data-testid^="option-change-count-"]
 *     [OPT] deltaLists     = 3      <- the delta rows DO render
 *     [OPT] viewMode       = "standard"
 *     [OPT] lodRung        = "quiet"
 *
 * All four option cards still returned in `cardsWhoseONLYAffordanceIsRename`.
 * #1871 fixed this line's OWN gate; the line never rendered because the
 * ENCLOSING one was `showLayer2Inline = isDetailed = viewMode === 'expert'`.
 *
 * Every test above runs in Expert view and passed throughout — which is exactly
 * why they could not see it. A jsdom render reaches branches the deployed view
 * never reaches, and only a census on the served build caught it.
 *
 * ⛔ MUTANT: put the line back inside the Expert fragment — the first case REDs,
 * the Expert regression guard stays green.
 */
describe('the route renders in the view the product opens in', () => {
  it('STANDARD view carries the route — the served-build case', () => {
    // Locked Canvas design (23 Sep 2026; spec §4 "never Expert-only"): the pencil.
    const line = renderCard('standard')
    expect(line, 'the route must render in Standard view').not.toBeNull()
    expect(line?.tagName.toLowerCase()).toBe('button')
    expect(oldCountLine()).toBeNull()
  })

  /**
   * ⭐ THE SECOND ROUTE IS ON THE FACE AGAIN (Paul 25 Sep: the prototype's
   * resting rows supersede ED #63 5809278282's popover placement). In the view
   * the product opens in, `+N more` sits on the card under the rows, with no
   * hover needed, and opens THIS option's inspector.
   */
  it('STANDARD view: `+N more` is on the card, under the rows, and opens THIS option', () => {
    renderCard('standard', undefined, 'idle', CEE_FOUR)
    const more = optionCardRows(OPTION_ID).querySelector<HTMLButtonElement>(`[data-testid="option-change-more-${OPTION_ID}"]`)
    expect(more?.textContent).toBe('+1 more')
    expect(document.querySelectorAll(`[data-testid="option-change-more-${OPTION_ID}"]`).length).toBe(1)
    openNodeInspector.mockClear()
    more!.click()
    expect(openNodeInspector).toHaveBeenCalledTimes(1)
    expect(openNodeInspector).toHaveBeenCalledWith(OPTION_ID)
  })

  it('REGRESSION GUARD — Expert view still carries it, once', () => {
    expect(renderCard('expert')).not.toBeNull()
    expect(oldCountLine()).toBeNull()
  })

  it('it is ONE control, not one per view — no duplicate in either view', () => {
    for (const view of ['standard', 'expert'] as const) {
      // ⚠ EACH RENDER GETS A CLEAN DOCUMENT. Without this the second iteration
      // queries a document holding BOTH renders and reports a duplicate the
      // product does not have — the assertion was right, the harness was not.
      cleanup()
      vi.clearAllMocks()
      renderCard(view)
      // Locked Canvas design (23 Sep 2026): the one route is the rail pencil.
      expect(
        document.querySelectorAll(`[data-testid="option-edit-targets-${OPTION_ID}"]`).length,
        `${view} rendered more than one route`,
      ).toBe(1)
      expect(document.querySelectorAll(`[data-testid="option-change-count-${OPTION_ID}"]`).length).toBe(0)
    }
  })

  it('CONTRAST CONTROL — the line still states the count in Standard view', () => {
    // Locked Canvas design (23 Sep 2026): the count rides the pencil's name.
    expect(renderCard('standard')?.getAttribute('aria-label') ?? '').toContain('2 factor targets')
  })

  /**
   * ⛔ THE CONDITION THAT TRAVELLED WITH THE LINE, AND IT NEEDED ITS OWN TEST.
   * Moving the line out of the Expert fragment meant re-stating that fragment's
   * other two conditions at the new site. A mutant DROPPING `!isBaselineOption`
   * SURVIVED the first version of this suite — the fixture's option is not a
   * baseline, so nothing exercised it, and a preserved condition nothing tests
   * is a condition the next change deletes for free.
   */
  it('a completed run: the route PERSISTS on the rail, and the old line stays gone', () => {
    // `isPostAnalysis = resultsStatus === 'complete'`. A mutant dropping
    // `!isPostAnalysis` also survived until this existed.
    // Locked Canvas design (23 Sep 2026; spec §4: "Standard view must indicate
    // that real editable targets can be changed. A persistent pencil…"): the
    // `!isPostAnalysis` gate was inherited from the old Expert fragment; the
    // rail pencil is persistent, so after a run the targets stay reachable.
    // The removed count line must not return in either phase.
    const pencil = renderCard('standard', undefined, 'complete')
    expect(pencil, 'the targets route must persist after a run').not.toBeNull()
    expect(pencil?.getAttribute('aria-label')).toBe(optionTargetsChannels({ count: 2 }).full)
    expect(oldCountLine()).toBeNull()
  })

  it('the baseline option still carries NO route — the inherited condition, guarded', () => {
    // Locked Canvas design (23 Sep 2026): the pencil keeps `!isBaselineOption`.
    expect(renderCard('standard', { is_baseline: true })).toBeNull()
    expect(oldCountLine()).toBeNull()
    cleanup()
    expect(renderCard('expert', { is_baseline: true })).toBeNull()
    expect(oldCountLine()).toBeNull()
  })
})
