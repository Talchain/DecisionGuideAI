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
import { COMMITMENT_COPY } from '../../../components/results/analysisNew/commitmentSynthesis'

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
  // V2 fidelity gap 24: the two tail groups are gone; what they held opens from About.
  'analysis-new-about',
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
    // V2 fidelity gap 24: "How this was worked out" and "Coaching and method" are gone.
    const GROUP_TITLES: readonly string[] = [
      ANALYSIS_NEW_COPY.sections.whatMovesTheOutcome,
    ]
    const allHeadings = Array.from(body.querySelectorAll('h3')).map(
      (h) => h.querySelector('[data-testid$="-title"]')?.textContent ?? h.textContent,
    )
    const groupHeadings = allHeadings.filter((t) => t !== null && GROUP_TITLES.includes(t))
    /*
     * ⭐⭐⭐ REASONING V2 (24 Sep 2026) — THE CENSUS WENT RED BY NAME, AS IT IS
     * MEANT TO WHEN A MOVE LANDS. Every change below is a V2 decision, listed
     * rather than silently absorbed:
     *   · `methods` (X) — the chip shelf is gone; the methods are the icon-only
     *     `MethodStrip` at the top, which carries no heading.
     *   · `strengthen` (X) — the wall is no longer mounted on this tab. Its
     *     findings are the Challenge card (one, at rest) and the review tool's
     *     queue; their placement is pinned in the next case, not here.
     *   · `checks` (X) — "What we checked" is absorbed into "About this
     *     analysis", which is last.
     *   · the commitment block ("Move towards commitment") is the answer zone's
     *     heading, and "About this analysis" closes the panel.
     * ⚠ THE CHALLENGE CARD'S OWN `h3` IS EXCLUDED BY IDENTITY: its text is the
     * engine's recommendation title, verbatim, so it names a finding, not a
     * section — pinning its words here would make the census depend on which
     * finding the fixture happens to raise.
     */
    const sectionHeadings = Array.from(body.querySelectorAll('h3'))
      .filter((h) => h.getAttribute('data-testid') !== 'analysis-new-challenge-heading')
      .map((h) => h.querySelector('[data-testid$="-title"]')?.textContent ?? h.textContent)
      .filter((t) => t === null || !GROUP_TITLES.includes(t))
    expect(sectionHeadings).toEqual([
      // ⚠ V2 FIRST SCREEN (24 Sep 2026): the answer zone's commitment block now
      // leads the sections. Paul's 17 Sep "what matters most means the drivers"
      // is still met BEFORE it, at rest, by the challenge's "Top drivers" signal
      // rows (which carry no h3); the full drivers section, closed, follows the
      // answer it explains so the options chart reaches the first screen.
      COMMITMENT_COPY.heading,
      ANALYSIS_NEW_COPY.sections.drivers,
      // V2 fidelity gaps 24 + 27: what the deleted tail groups held now opens
      // INSIDE About (opened above), so Key insights and Uncertainty still close
      // the census, RUN DETAILS LAST. About's own label is the prototype's
      // footer `.disclose` line, not an h3 — its presence and its name are
      // asserted in the landmark case below.
      ANALYSIS_NEW_COPY.sections.keyInsights,
      ANALYSIS_NEW_COPY.sections.uncertainty,
    ])
    // The pre-V2 census, kept as the record of what moved (not asserted):
    // methods, drivers, strengthen, keyInsights, checks, uncertainty.
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
      'the disclosure groups must render, in reading order',
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
      // V2 fidelity gap 24 (24 Sep 2026): `coachingAndMethod` and `howWorkedOut`
      // are deleted with the "If you want to go further" zone; their contents
      // fold into About (asserted in the census above and in
      // `theTailFoldsIntoAbout.spec.tsx`).
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
    const body = screen.getByTestId('analysis-new-tab-body')
    /**
     * ⭐ REASONING V2 (24 Sep 2026): THE COACHING IS THE CHALLENGE CARD, AND IT
     * LEADS. "Strengthen the reasoning" is not mounted on this tab any more;
     * the one grounded intervention is `ChallengeCard`, in "Challenge the
     * thinking", which V2 places ABOVE the answer zone. So the claim is now
     * stronger than the 17 Sep list it replaces: no `h3` on the tab precedes
     * the coaching — not the drivers, not the answer, no detail. (Scope, per
     * the note above: the `h3` census of THIS harness, which seeds no canvas
     * nodes, so Focus Now — an `h2`, and run-conditional — is not in view.)
     *
     * ⚠ STATED AS AN EXACT RELATION, NOT AN INDEX, and bound by IDENTITY (the
     * card's testid), because the card's text is the engine's own title and
     * varies with the finding. It REDs the moment any section creeps above it.
     */
    const all = Array.from(body.querySelectorAll('h3'))
    const card = screen.getByTestId('analysis-new-challenge-heading')
    expect(all.indexOf(card as HTMLHeadingElement), 'the coaching must be the first heading on the tab').toBe(0)
    const uncertainty = document.getElementById('analysis-new-uncertainty-heading')
    expect(uncertainty, 'precondition: the detail this is measured against rendered').not.toBeNull()
    expect(all.indexOf(card as HTMLHeadingElement)).toBeLessThan(all.indexOf(uncertainty as HTMLHeadingElement))
    // …and the rest of the findings are one step above it: the review tool
    // sits under the model strip, before the card in document order.
    const review = screen.getByTestId('analysis-new-review')
    expect(
      review.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the review tool must precede the Challenge card',
    ).toBeTruthy()
  })

  it('every section is a labelled landmark with a real heading', () => {
    seedCompletedRun()
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    openReasoningGroups()
    /*
     * V2: `analysis-new-strengthen` is retired from this tab (X) — the Challenge
     * card and the review tool replace it and are not section landmarks. The
     * V2 sections that are landmarks join the list: the commitment block (its
     * heading id is `-title`, so each entry names its own heading id rather
     * than assuming a suffix) and "About this analysis".
     */
    for (const [testId, headingId] of [
      ['analysis-new-key-insights', 'analysis-new-key-insights-heading'],
      ['analysis-new-drivers', 'analysis-new-drivers-heading'],
      ['analysis-new-uncertainty', 'analysis-new-uncertainty-heading'],
      ['analysis-new-commitment', 'analysis-new-commitment-title'],
      // V2 gap 27: About's label is its footer toggle's title span, not a
      // heading element (the prototype draws none) — still a labelled region.
      ['analysis-new-about', 'analysis-new-about-heading'],
    ] as const) {
      const section = screen.getByTestId(testId)
      expect(section.tagName).toBe('SECTION')
      expect(section.getAttribute('aria-labelledby')).toBe(headingId)
      expect(document.getElementById(headingId)).not.toBeNull()
    }
  })
})
