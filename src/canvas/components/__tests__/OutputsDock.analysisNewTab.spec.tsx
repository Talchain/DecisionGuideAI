/**
 * ANALYSIS (NEW) — THE COMPARISON TAB, AND THE PROOF THE OLD ONE DID NOT MOVE.
 *
 * The experiment (Paul, 27 Aug 2026) adds a SECOND Analysis surface beside the
 * existing one so the two information architectures can be compared on one
 * scenario. Its hard constraint is that the existing Analysis tab is untouched.
 *
 * ── WHY THE PRESERVATION CASE IS NOT "THE NEW TAB EXISTS" ──────────────────
 * The brief asks for a DISCRIMINATING regression test, and it is right to: a
 * spec that asserts the new tab mounted would pass just as happily on a change
 * that reordered, restyled or silently re-propped the old one. So the
 * preservation case captures the Analysis surface's rendered TESTID SEQUENCE
 * and its TEXT, drives a full round trip through the new tab, and asserts both
 * come back identical.
 *
 * That pins exactly what §8 forbids moving — render tree, ordering, copy,
 * component removal — and it is immune to `useId` churn across the remount,
 * which a raw innerHTML diff is not (the results branch is a bare conditional
 * render, so switching tabs genuinely unmounts and remounts it, and React's id
 * counter advances). Attribute-level identity is deliberately NOT claimed here;
 * the advisory visual-regression harness owns pixels.
 *
 * ⚠ AND ITS POSITIVE CONTROL. A sequence comparison passes trivially when both
 * sides are empty (CLAUDE.md trap 13 — an absence probe with no positive
 * control proves nothing). `RESULTS_TESTID_FLOOR` asserts the captured sequence
 * is substantial BEFORE it is compared, so a harness that stubbed the Analysis
 * surface into nothing fails loudly instead of certifying it unchanged. This is
 * also why the pre-analysis panels are NOT mocked out in this file.
 *
 * ── MOUNT PATH IS ASSERTED, NOT ASSUMED (trap 3b) ──────────────────────────
 * This estate has twice shipped a feature dark because its tests targeted a
 * component the deployed flag posture does not render. MOUNT PATH below asserts
 * the contract declarations themselves, with contrast controls, so a moved
 * declaration REDs here rather than silently retargeting every case.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

// ── heavy-import stubs: only what genuinely breaks under jsdom ──────────────
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})
// The real readiness hook fetches a relative URL on mount, which jsdom rejects
// as an unhandled rejection. Stubbed so the fetch spy below measures only what
// a TAB SWITCH causes — the question this file exists to answer.
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

// Flags: spread the real module — a hand-listed factory REPLACES it and
// silently drops every flag added later (trap 12; it killed 51 tests here once).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isAiPanelV2Enabled: () => true,
    isTelemetryEnabled: () => false,
    isCompareTabEnabled: () => false,
    isJourneyTabEnabled: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { ToastProvider } from '../../ToastContext'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import {
  MAX_PRESENTED_SURFACES,
  WORKSPACE_SURFACES,
  WORKSPACE_SURFACE_ORDER,
  presentedSurfaces,
} from '../workspaceShell/shellContract'
import { ANALYSIS_NEW_COPY } from '../../../components/results/analysisNew/analysisNewCopy'

const NEW_TAB = 'outputs-dock-tab-analysisNew'
const OLD_TAB = 'outputs-dock-tab-results'
const BODY = 'outputs-dock-body'

/**
 * The Analysis surface must render at least this many testid-bearing elements
 * for the preservation comparison to mean anything. Measured at the tip this
 * spec was written against; a floor, not a pin, so ADDING to the Analysis tab
 * in a later change does not RED this file — only stubbing it into nothing does.
 */
const RESULTS_TESTID_FLOOR = 5

/**
 * Render the dock AND expand it.
 *
 * ⚠ THE DOCK MOUNTS COLLAPSED IN THIS HARNESS, and the collapsed rail renders a
 * DIFFERENT set of testids (`outputs-dock-rail-tab-*`). Every case below is
 * about the expanded strip and the body, so expansion is a precondition, not a
 * step under test. Tolerant of both starting states — the dock's open flag is
 * module-level and survives `cleanup()` — and asserts only its POSTCONDITION.
 */
function renderDock() {
  const result = render(
    <ToastProvider>
      <ConversationProvider>
        <OutputsDock />
      </ConversationProvider>
    </ToastProvider>,
  )
  const control = screen.getByTestId('dock-collapse-control')
  if (control.getAttribute('aria-label') === 'Expand outputs dock') {
    fireEvent.click(control)
  }
  expect(screen.getByTestId(OLD_TAB), 'the dock did not expand').toBeInTheDocument()
  return result
}

/**
 * The named groups the Reasoning tab's detail now sits behind.
 *
 * ⛔ WHY THE STRUCTURE CASES NEEDED THIS. `SectionShell` UNMOUNTS a closed
 * region (unlike `Accordion`, which these groups used to be and which kept its
 * children mounted). So a census of the tab's sections that does not open the
 * groups is reading content the reader CANNOT SEE — and section C's ordering
 * assertions were doing exactly that, comparing one visible heading against a
 * list of five.
 *
 * ⚠ OPENS ONLY THE OUTER LEVEL. Every section inside keeps its own default, so
 * the collapsed-IA claim these cases rest on is unchanged.
 */
const REASONING_GROUPS = [
  'analysis-new-how-worked-out',
  'analysis-new-coaching-and-method',
  'analysis-new-what-moves-the-outcome',
]
function openReasoningGroups(): void {
  for (const id of REASONING_GROUPS) {
    const toggle = screen.queryByTestId(`${id}-toggle`)
    if (toggle !== null && toggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(toggle)
    }
  }
}

/**
 * ⚠ FRONT THE ANALYSIS TAB, BECAUSE IT IS NO LONGER WHAT THE DOCK OPENS ON.
 *
 * Until 9 Sep 2026 the dock's default WAS `results`, so every "the Analysis
 * surface is unchanged" case below got it for free. The default-tab ruling
 * moved it to Reasoning (`DEFAULT_WORKSPACE_SURFACE`), which does not weaken
 * any claim in section A — those cases are about what the Analysis surface
 * RENDERS — but it does mean the surface must now be fronted deliberately.
 *
 * This is a HARNESS repair, not a relaxation: section A's positive control
 * (`RESULTS_TESTID_FLOOR`) is exactly what would have caught the difference,
 * and it still asserts the captured surface is substantial. Fronting by CLICK
 * and asserting the POSTCONDITION binds the object by identity, so a case can
 * never quietly end up measuring the other Analysis surface.
 */
function frontAnalysisTab() {
  const tab = screen.getByTestId(OLD_TAB)
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab)
  expect(
    screen.getByTestId(OLD_TAB).getAttribute('aria-selected'),
    'the Analysis tab is not fronted — this case would measure the wrong surface',
  ).toBe('true')
}

/**
 * ⚠⚠ SECTION C ASSERTS A COMPLETED-RUN STRUCTURE, SO IT MUST MOUNT A COMPLETED
 * RUN. It did not, and that is why these three cases had to change.
 *
 * The harness store is empty, so `OutputsDock` derives `isPreRun = true`. The
 * cases below passed anyway, because an empty section used to render its
 * heading over nothing. Once the surface stopped printing headings with nothing
 * beneath them — a defect found by driving the pre-run state on a real build —
 * the four headings vanished and these assertions failed.
 *
 * The assertions were right about the IA and wrong about the state they were
 * making it in: "the four sections appear in this order" is a claim about a
 * surface showing an analysis. So the fix is to establish the precondition, not
 * to relax the claim. `hasCompletedFirstRun` is exactly the flag `isPreRun`
 * negates (`OutputsDock.tsx:719`), which is why it is set HERE rather than a
 * whole result being faked: the sections' post-run empty states are real copy
 * and render real headings, so the structure is genuinely exercised.
 */
function seedCompletedRun() {
  useCanvasStore.setState({ hasCompletedFirstRun: true } as never)
}

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}
function ensureScrollIntoView() {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
}

/** The ordered testid sequence + text of whatever the dock body is showing. */
function captureBody() {
  const body = screen.getByTestId(BODY)
  return {
    testIds: Array.from(body.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    ),
    text: body.textContent ?? '',
  }
}

beforeEach(() => {
  ensureMatchMedia()
  ensureScrollIntoView()
  try {
    sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  // ⚠ The URL is a singleton across the whole FILE in jsdom, and `handleTabClick`
  // writes a `?tab=` deep link. Without this reset the first case's click leaks
  // into every later mount and misattributes their failures.
  window.history.replaceState({}, '', '/')
  // ⚠ SAME LEAK CLASS AS THE URL ABOVE. `hasCompletedFirstRun` is store state
  // with no per-test reset, so `seedCompletedRun()` in one case would silently
  // put every LATER case into the post-run branch — and a pre-run assertion
  // that only passes because an earlier test seeded a run is order-dependent
  // and passes for the wrong reason. Reset it, so each case states its own
  // precondition.
  useCanvasStore.setState({ hasCompletedFirstRun: false } as never)
  // ⚠ THE SAME LEAK CLASS AGAIN, AND IT ONLY BECAME VISIBLE ON 9 Sep 2026.
  // `handleTabClick('results')` calls `setShowResultsPanel(true)`, and that flag
  // is store state with no per-test reset — so one case fronting Analysis left
  // every LATER mount tripping the dock's external show-results trigger, which
  // legitimately fronts Analysis. While `results` was also the default that was
  // invisible: the leak and the default agreed. Now they do not, so it must be
  // reset like the two above, or a default-tab case passes or fails on which
  // test ran before it.
  useCanvasStore.setState({ showResultsPanel: false } as never)
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 } as never)
  useFloatingPanelState.setState({ isOpen: false, isMinimised: false, source: 'user' } as never)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('MOUNT PATH — the declarations this experiment depends on', () => {
  it('declares Analysis (New) as a presented surface, adjacent to Analysis', () => {
    expect(WORKSPACE_SURFACES.analysisNew.presentedAsTab).toBe(true)
    expect(WORKSPACE_SURFACES.analysisNew.label).toBe('Reasoning')
    const order = WORKSPACE_SURFACE_ORDER
    expect(order.indexOf('analysisNew')).toBe(order.indexOf('results') + 1)
    // CONTRAST CONTROL: not every declared surface is presented, so "some
    // surface is presented" cannot satisfy the assertion above.
    expect(WORKSPACE_SURFACES.compare.presentedAsTab).toBe(false)
    expect(WORKSPACE_SURFACES.journey.presentedAsTab).toBe(false)
  })

  it('the recorded strip budget matches the presented set', () => {
    // The budget is a RECORDED literal by design — deriving it would make the
    // conformance guard a tautology. This asserts the record was updated.
    expect(presentedSurfaces()).toHaveLength(MAX_PRESENTED_SURFACES)
  })

  it('asks the shell for the reanalyse footer, so no second run authority exists', () => {
    expect(WORKSPACE_SURFACES.analysisNew.footerBar).toBe('reanalyse')
    // CONTRAST CONTROL: the three footer arms are genuinely different.
    expect(WORKSPACE_SURFACES.results.footerBar).toBe('none')
    expect(WORKSPACE_SURFACES.olumi.footerBar).toBe('readiness')
  })
})

// ═══════════════════════════════════════════════════════════════════════════

describe('A · THE EXISTING ANALYSIS TAB IS UNCHANGED', () => {
  it('its own contract declaration is byte-for-byte what it was', () => {
    // The cheapest discriminating guard there is: if anyone re-declares the
    // Analysis surface while adding to this experiment, this REDs by name.
    expect(WORKSPACE_SURFACES.results).toEqual({
      id: 'results',
      label: 'Analysis',
      footerBar: 'none',
      scroll: 'self',
      padding: 'self',
      presentedAsTab: true,
      hiddenReason: '',
    })
  })

  it('survives a full round trip through Analysis (New) with an identical render tree, ordering and copy', () => {
    renderDock()
    frontAnalysisTab()

    const before = captureBody()
    // POSITIVE CONTROL — without this, two empty captures would "match" and
    // this case would certify a surface it never saw.
    expect(
      before.testIds.length,
      'the Analysis surface rendered almost nothing — this comparison would be vacuous',
    ).toBeGreaterThanOrEqual(RESULTS_TESTID_FLOOR)
    expect(before.text.trim().length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId(NEW_TAB))
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(OLD_TAB))
    const after = captureBody()

    // Render tree AND ordering.
    expect(after.testIds).toEqual(before.testIds)
    // Copy.
    expect(after.text).toBe(before.text)
  })

  it('does not render any Analysis (New) element while Analysis is fronted', () => {
    renderDock()
    frontAnalysisTab()
    // Binds to the new surface's own root testid — a leak of the experimental
    // IA into the old tab is exactly what §8 forbids.
    expect(screen.queryByTestId('analysis-new-tab-body')).toBeNull()
    expect(screen.queryByTestId('analysis-new-key-insights')).toBeNull()
    expect(screen.queryByTestId('analysis-new-strengthen')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠⚠ THIS SECTION'S RULE WAS REVERSED, AND THE REVERSAL IS RECORDED RATHER
 * THAN OVERWRITTEN.
 *
 * It read `B · THE NEW TAB IS MOUNTED, AND IS NOT THE DEFAULT`, and its case
 * asserted *"Analysis, not Analysis (New), is what the dock opens on"*. That
 * was correct for the 27 Aug 2026 experiment, which was explicitly additive.
 *
 * Paul ruled on 9 Sep 2026 that a fresh, UNCHOSEN session lands on Reasoning —
 * he had measured `outputs-dock-tab-results` carrying `aria-selected="true"`
 * for a fresh individual, on a surface ruled out of scope. So this is a RULING
 * REVERSAL, not a broken test: the case is rewritten to pin the NEW rule, and
 * the old rule is quoted above so a reader who remembers it can see it moved,
 * when, and on whose authority.
 *
 * The default's own boundaries — restore, click, deep link, run start, and the
 * inverse of each — live in `OutputsDock.defaultTab.spec.tsx`. This section
 * keeps only the claim it was always making: which surface the dock opens on.
 */
describe('B · THE NEW TAB IS MOUNTED, AND IS NOW THE DEFAULT (ruling reversed 9 Sep 2026)', () => {
  it('appears in the strip under its exact label', () => {
    renderDock()
    const tab = screen.getByTestId(NEW_TAB)
    expect(tab).toBeInTheDocument()
    expect(tab).toHaveTextContent('Reasoning')
  })

  it('Reasoning, not Analysis, is what the dock opens on', () => {
    renderDock()
    expect(screen.getByTestId(BODY)).toBeInTheDocument()
    // Bound by identity on BOTH tabs, so a strip that lost its selection
    // entirely — or fronted both — cannot satisfy this.
    expect(screen.getByTestId(NEW_TAB)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId(OLD_TAB)).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()
    // ⚠ AND THE GLOBAL DELIBERATELY DISAGREES ON A FRESH MOUNT. The dock's
    // default is its own; `useUIStore.activeOutputTab` keeps its initial
    // 'results' because it is a global with consumers outside this dock, and
    // nothing syncs dock→store until the user acts. Asserted rather than
    // ignored, so a later change that starts pushing the default into the
    // store REDs here and gets read against `FloatingOlumiPanel`'s yield gate
    // rather than landing silently.
    expect(useUIStore.getState().activeOutputTab).toBe('results')
  })

  it('switching tabs issues NO network request and mutates NO canonical state', () => {
    // ⭐ THE PROPERTY THE WHOLE COMPARISON RESTS ON. If a tab switch re-ran
    // analysis, produced a second result, or moved canonical state, the two
    // surfaces would no longer be showing the same run and Paul's side-by-side
    // would be measuring different data, not different layouts.
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}')))
    vi.stubGlobal('fetch', fetchSpy)

    renderDock()
    const before = useCanvasStore.getState()
    const resultsBefore = before.results
    const callsAfterMount = fetchSpy.mock.calls.length

    fireEvent.click(screen.getByTestId(NEW_TAB))
    fireEvent.click(screen.getByTestId(OLD_TAB))
    fireEvent.click(screen.getByTestId(NEW_TAB))

    const after = useCanvasStore.getState()
    expect(fetchSpy.mock.calls.length, 'a tab switch issued a network request').toBe(callsAfterMount)
    // Referential identity, not deep equality: a re-derivation that produced an
    // equal-but-new object would still be a second computation, and deep
    // equality would wave it through.
    expect(after.results).toBe(resultsBefore)
    expect(after.nodes).toBe(before.nodes)
    expect(after.edges).toBe(before.edges)
    expect(after.analysisStateV1).toBe(before.analysisStateV1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════

describe('C · THE SECTION STRUCTURE', () => {
  it('renders Strengthen the reasoning, What we checked, Key insights, Drivers and dynamics, Uncertainty and gaps — in that order', () => {
    seedCompletedRun()
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    openReasoningGroups()

    // ⚠ THE ORDER CLAIM IS UNCHANGED; ONLY THE BINDING IS TIGHTER. Each section
    // header is now a collapsed disclosure row, so the `h3` legitimately
    // contains the title AND the count ("Key insights 3, button, collapsed" is
    // what a screen reader should say). Reading raw `textContent` would fold
    // the count into the title and fail on a change that is correct. Binding to
    // the title element keeps this an exact claim about WHICH sections appear
    // and in WHAT order (CLAUDE.md trap 19).
    const body = screen.getByTestId('analysis-new-tab-body')
    const GROUP_TITLES: readonly string[] = [
      ANALYSIS_NEW_COPY.sections.howWorkedOut,
      ANALYSIS_NEW_COPY.sections.coachingAndMethod,
      ANALYSIS_NEW_COPY.sections.whatMovesTheOutcome,
    ]
    const allHeadings = Array.from(body.querySelectorAll('h3')).map(
      (h) => h.querySelector('[data-testid$="-title"]')?.textContent ?? h.textContent,
    )
    const groupHeadings = allHeadings.filter((t) => t !== null && GROUP_TITLES.includes(t))
    const headings = allHeadings.filter((t) => t === null || !GROUP_TITLES.includes(t))
    expect(headings).toEqual([
      /*
       * ⭐⭐ METHODS LEAD, AND THAT IS THE RULING RATHER THAN A DRIFT. ZONE:
       * FOCUS sits above ZONE: ANSWER, and its gate now admits the static
       * `METHOD_CATALOGUE` as well as the run's own focus ids, so the zone
       * renders on EVERY run instead of only when the producer raised
       * something. Paul, 18 Sep 2026: "Surface the Methods menu — make it
       * prominent", then "make it first-screen — put it in ZONE: FOCUS".
       *
       * ⭐ THIS CENSUS GOING RED IS THE PROOF THE MOVE LANDED — the same thing
       * the drivers note below records for its own move. The section is added
       * to the list, never excluded from it, so the census still pins which
       * sections appear and in what order.
       */
      ANALYSIS_NEW_COPY.sections.methods,
      // ⭐ #1082's trust readout, mounted in the same commit that added this
      // line. Its appearance HERE is the positive control that the mount is
      // real rather than a no-op import: this census went RED on it, by name.
      // ⚠⚠ DRIVERS NOW LEAD, AND STRENGTHEN FOLLOWS THEM — Paul's ruling,
      // 17 Sep 2026. Asked which of two senses of his acceptance bar's "what
      // matters most" was intended — the DRIVERS (what the answer turns on) or
      // the recommended next move — he ruled the drivers, so "What moves the
      // outcome" moved into the ANSWER zone and its inner "Drivers and
      // dynamics" heading came with it.
      //
      // ⭐ THIS CENSUS GOING RED IS THE PROOF THE MOVE LANDED, exactly as the
      // uncertainty note below records for its own move. The heading is not
      // removed from the list — it is REPOSITIONED, so the census still pins
      // which sections appear and in what order.
      /*
       * ⭐⭐⭐ STRENGTHEN NOW PRECEDES THE DRIVERS — Paul, 19 Sep 2026: "move the
       * coaching up, that's the whole point of the product".
       *
       * ⚠ HIS 18 Sep DRIVERS RULING IS NOT REVERSED, and that is why this list
       * changed by a SWAP rather than a rewrite. That ruling ordered the
       * ANSWER's contents — drivers before options and implication — and
       * `everySectionBelongsToAZone` still pins it, scoped to that zone's own
       * children. Untouched. What moved is the whole ZONE: ALSO block, from
       * below the answer to above it.
       *
       * ⭐ WHY THE WHOLE ZONE: `PrimaryIntervention` is a POINTER to one of the
       * Strengthen rows. Moving the rows alone would leave the pointer below the
       * thing it promotes, and would empty a labelled group — the defect #1715
       * had just repaired.
       *
       * ⚠ MEASURED: on the served build at viewport 768 the coaching sat 762px
       * below the glance with SIX sections between them, a 1.7-screen scroll.
       * The spec pinning "the coaching sits directly under the reading it
       * responds to" read as SATISFIED throughout — its scope note censuses
       * heading-bearing sections only.
       */
      ANALYSIS_NEW_COPY.sections.strengthen,
      ANALYSIS_NEW_COPY.sections.drivers,
      // ⚠ STRENGTHEN LEADS THE DETAIL AS OF THE REORDER. The coaching was
      // seventh of ten MOUNTS — below the ranked options and below Key
      // insights — and this census could not see that; see the scope note on
      // the case below. It still leads everything that is DETAIL; what now
      // precedes it is part of the answer.
      /**
       * ⭐ UNCERTAINTY MOVED UP TO SIT WITH CHECKS — deliberate, and this
       * census going RED on it is the positive proof the move landed.
       *
       * Both sections answer "what this run could NOT settle", and they were
       * SIX SECTIONS APART: the checks readout twelfth, uncertainty eighteenth,
       * with the value-of-information line nineteenth. Measured on a
       * reconstruction of the run Paul screenshotted, one category of
       * information was spread over six places, so a reader met the same kind
       * of statement six times in six registers and never knew they had seen
       * the set.
       *
       * ⚠ THE HEDGES WERE NOT DEDUPLICATED, AND THAT WAS MEASURED BEFORE THE
       * MOVE: eight distinct "could not establish" statements on that run, only
       * two anything like duplicates. So this is a re-composition and nothing
       * was deleted — several of those sentences were written to close a
       * specific fabrication.
       *
       * Adjacency (rather than mere precedence) is pinned by
       * `whatTheRunCouldNotSettleIsOnePlace.spec.tsx`; "uncertainty follows
       * checks" was already true when they were six sections apart, so it is
       * the assertion that would have passed throughout the defect.
       */
      ANALYSIS_NEW_COPY.sections.keyInsights,
      /**
       * ⭐⭐ CHECKS AND UNCERTAINTY MOVED TO THE END — and the ADJACENCY the
       * note above pins is untouched: they moved together, as one group.
       *
       * Measured in the deployed DOM on `232b2d31`, expanded: the top section
       * is 268px and the machinery below it totals 1741px, with "How this was
       * worked out" alone at 713px — 2.7x the options comparison — sitting
       * FOURTH of ten. The approved prototype `reasoningpanelv3` orders the
       * panel model state -> Focus now -> What your model implies -> Drivers
       * and dynamics -> Uncertainty and gaps -> RUN DETAILS LAST.
       *
       * ⚠ THE GROUPING FIX WAS ALREADY MADE AND WAS NOT ENOUGH. The note below
       * records twelve top-level headings becoming six groups in answer to
       * Paul's "unwieldy dump" report. He reported the same complaint again on
       * 16 Sep against the grouped build, so grouping was necessary and not
       * sufficient: what remained was that the run's MACHINERY sat in the
       * middle, at the largest size on the surface.
       *
       * ⚠ THIS CENSUS GOING RED IS THE INTENDED SIGNAL, not collateral — the
       * header above says so ("this census going RED on it is the positive
       * proof the move landed"). It was also the ONLY thing that caught this
       * move: it lives in `canvas/components/__tests__/`, and a 158-file run of
       * `analysisNew/__tests__/` was green. CI was the authority.
       */
      ANALYSIS_NEW_COPY.sections.checks,
      ANALYSIS_NEW_COPY.sections.uncertainty,
    ])
    /**
     * ⭐⭐ AND THE GROUPS THEY NOW SIT IN. The tab renders THREE named
     * `Accordion` headings — the structure Paul's "unwieldy dump" report
     * produced, where twelve top-level headings became six and seven sections
     * that all answered "how far can I trust this?" went behind one.
     *
     * ⚠ ASSERTED SEPARATELY, ON PURPOSE. Folding them into the census above
     * would make one list carry two different claims — which sections exist and
     * in what order (the census's job) and which GROUPS contain them (the
     * restructure's). Two questions under one assertion is how a census stops
     * discriminating (CLAUDE.md trap 21); keeping them apart means a regression
     * in either is legible as itself.
     */
    expect(
      groupHeadings,
      'the three disclosure groups must render, in reading order',
    ).toEqual([
      // ⚠ RUN DETAILS LAST, per the prototype — see the census note above. The
      // group order is asserted separately from the section census on purpose,
      // so a regression in either stays legible as itself (trap 21).
      //
      // ⚠⚠ "What moves the outcome" LEADS AS OF 17 Sep 2026, on Paul's ruling
      // that the DRIVERS are what his acceptance bar means by "what matters
      // most". The group moved into the ANSWER zone, so it now renders before
      // the two that remain in "If you want to go further". RUN DETAILS LAST is
      // untouched — `howWorkedOut` is still last, which is the part of this
      // line the prototype actually rules on.
      //
      // ⭐ THIS ASSERTION WAS NEVER REACHED BEFORE THE FIX ABOVE, and that is
      // worth recording: it sits in the same `it` as the section census, after
      // it, so while the census REDed this line never executed. One test, two
      // claims, and the second is invisible whenever the first fails.
      ANALYSIS_NEW_COPY.sections.whatMovesTheOutcome,
      ANALYSIS_NEW_COPY.sections.coachingAndMethod,
      ANALYSIS_NEW_COPY.sections.howWorkedOut,
    ])
  })

  it('puts Strengthen the reasoning near the TOP, not at the end', () => {
    // The placement IS the experiment. On the existing Analysis tab the same
    // material is the FIFTH of eleven named sections in `ResultsBody` (below
    // Decision brief, Analysis hero, Key question and What I was given), plus
    // the warning strips and status furniture above it.
    //
    // ⚠⚠ THE SCOPE OF THIS CENSUS, STATED BECAUSE IT IS A BLIND SPOT AND NOT
    // AN OBVIOUS ONE (trap 20 — name the artefact searched, never the
    // generalisation). `headings` is every `h3` the body renders, which is the
    // SectionShell sections and NOT the full run of things a reader scrolls
    // past: `ModelStrip`, `AtAGlance` and the two warning strips carry no
    // `h3`, and `OptionsComparison` renders NOTHING AT ALL here because
    // `seedCompletedRun()` seeds no options and it returns null on
    // `totalCount === 0`.
    //
    // So the index below is a position among the HEADING-BEARING sections,
    // several places above where a reader actually meets this material. It is
    // a true assertion about a smaller surface than its name suggests — the
    // same shape as a `SECTIONS` entry that covers nothing because the fixture
    // drops the section. It is left EXACT rather than loosened, with the scope
    // written down so the next reader inherits it instead of the
    // generalisation; a claim about the whole assembled surface has to be made
    // where the whole surface is in view, not here.
    //
    // ⭐⭐ AND THAT IS NOT HYPOTHETICAL — IT IS WHAT THIS CASE DID. Named
    // "near the TOP, not at the end", it read `1` and was GREEN for weeks
    // while the coaching sat SEVENTH OF TEN mounts, below the ranked options
    // and below Key insights. The reorder that fixed the burial is what
    // finally moved this index, and the spec asserting the property was the
    // last thing to notice the property was false. The claim it structurally
    // cannot make — Strengthen above the options comparison on a run that HAS
    // options — is pinned where the whole surface is in view, in
    // `analysisNew/__tests__/AnalysisNewTabBody.spec.tsx` ("the coaching sits
    // directly under the reading it responds to"). Deliberately NOT duplicated
    // here: two derivations of one claim disagree the first time either moves
    // (trap 12).
    seedCompletedRun()
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    openReasoningGroups()
    // Same tightened binding as the case above — the heading row now carries a
    // count alongside the title, and the placement claim is about the TITLE.
    const body = screen.getByTestId('analysis-new-tab-body')
    const GROUP_TITLES: readonly string[] = [
      ANALYSIS_NEW_COPY.sections.howWorkedOut,
      ANALYSIS_NEW_COPY.sections.coachingAndMethod,
      ANALYSIS_NEW_COPY.sections.whatMovesTheOutcome,
    ]
    const allHeadings = Array.from(body.querySelectorAll('h3')).map(
      (h) => h.querySelector('[data-testid$="-title"]')?.textContent ?? h.textContent,
    )
    // ⚠ The GROUP headings are filtered out here too, so this case keeps
    // asking only about section order. They are asserted by name in the census
    // above; re-asserting them here would spread one claim over two cases.
    const headings = allHeadings.filter((t) => t === null || !GROUP_TITLES.includes(t))
    /**
     * ⚠⚠ THIS SAID `toBe(0)` UNTIL 17 Sep 2026, AND A LITERAL INDEX IS NOT THE
     * CLAIM. Paul ruled that the DRIVERS are part of the answer, so "What moves
     * the outcome" moved into the answer zone and its inner heading now
     * precedes the coaching. Under `toBe(0)` that reads as a regression; it is
     * not one, and the case's own title — "near the TOP, not at the end" — was
     * never about being first.
     *
     * ⛔ SO THE CLAIM IS STATED RATHER THAN NUMBERED, and it is STRONGER than
     * the literal it replaces: it names exactly what may precede the coaching.
     * `toBe(0)` could only say "nothing precedes it"; this says "one thing
     * does, and it is the answer's tail" — which REDs if any DETAIL section
     * creeps above the coaching, the defect the case exists to catch.
     */
    const beforeStrengthen = headings.slice(0, headings.indexOf(ANALYSIS_NEW_COPY.sections.strengthen))
    /*
     * ⚠ TWO MAY NOW PRECEDE THE COACHING, AND THE CASE IS NOT WEAKENED BY IT.
     * The claim is still an EXACT list rather than a count or an index, so it
     * REDs the moment any DETAIL section creeps above the coaching — which is
     * the defect this case exists to catch. What changed is that ZONE: FOCUS
     * renders unconditionally, and it sits above the answer by design.
     */
    expect(
      beforeStrengthen,
      'only the methods a person can choose, and the answer, may precede the coaching',
      // ⭐ ONLY THE METHODS NOW PRECEDE THE COACHING. The drivers moved BELOW it
      // with the rest of the answer (Paul, 19 Sep). Still an EXACT list rather
      // than a count, so a detail section creeping above the coaching still REDs.
    ).toEqual([ANALYSIS_NEW_COPY.sections.methods])
    expect(headings.indexOf(ANALYSIS_NEW_COPY.sections.strengthen)).toBeLessThan(
      headings.indexOf(ANALYSIS_NEW_COPY.sections.uncertainty),
    )
  })

  it('every section is a labelled landmark with a real heading', () => {
    seedCompletedRun()
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    openReasoningGroups()
    for (const testId of [
      'analysis-new-key-insights',
      'analysis-new-strengthen',
      'analysis-new-drivers',
      'analysis-new-uncertainty',
    ]) {
      const section = screen.getByTestId(testId)
      expect(section.tagName).toBe('SECTION')
      expect(section.getAttribute('aria-labelledby')).toBe(`${testId}-heading`)
      expect(document.getElementById(`${testId}-heading`)).not.toBeNull()
    }
  })
})
