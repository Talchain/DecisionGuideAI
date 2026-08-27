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
    expect(WORKSPACE_SURFACES.analysisNew.label).toBe('Analysis (New)')
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
    // Binds to the new surface's own root testid — a leak of the experimental
    // IA into the old tab is exactly what §8 forbids.
    expect(screen.queryByTestId('analysis-new-tab-body')).toBeNull()
    expect(screen.queryByTestId('analysis-new-key-insights')).toBeNull()
    expect(screen.queryByTestId('analysis-new-strengthen')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════

describe('B · THE NEW TAB IS MOUNTED, AND IS NOT THE DEFAULT', () => {
  it('appears in the strip under its exact label', () => {
    renderDock()
    const tab = screen.getByTestId(NEW_TAB)
    expect(tab).toBeInTheDocument()
    expect(tab).toHaveTextContent('Analysis (New)')
  })

  it('Analysis, not Analysis (New), is what the dock opens on', () => {
    renderDock()
    expect(screen.getByTestId(BODY)).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-tab-body')).toBeNull()
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

describe('C · THE FOUR-SECTION STRUCTURE', () => {
  it('renders Key insights, Strengthen the reasoning, Drivers and dynamics, Uncertainty and gaps — in that order', () => {
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))

    const body = screen.getByTestId('analysis-new-tab-body')
    const headings = Array.from(body.querySelectorAll('h3')).map((h) => h.textContent)
    expect(headings).toEqual([
      ANALYSIS_NEW_COPY.sections.keyInsights,
      ANALYSIS_NEW_COPY.sections.strengthen,
      ANALYSIS_NEW_COPY.sections.drivers,
      ANALYSIS_NEW_COPY.sections.uncertainty,
    ])
  })

  it('puts Strengthen the reasoning near the TOP, not at the end', () => {
    // The placement IS the experiment. On the existing Analysis tab the same
    // material sits roughly eleventh, below the option comparison.
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    const body = screen.getByTestId('analysis-new-tab-body')
    const headings = Array.from(body.querySelectorAll('h3')).map((h) => h.textContent)
    expect(headings.indexOf(ANALYSIS_NEW_COPY.sections.strengthen)).toBe(1)
    expect(headings.indexOf(ANALYSIS_NEW_COPY.sections.strengthen)).toBeLessThan(
      headings.indexOf(ANALYSIS_NEW_COPY.sections.uncertainty),
    )
  })

  it('every section is a labelled landmark with a real heading', () => {
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
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
