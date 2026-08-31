/**
 * A THROW IN ANALYSIS (NEW) MUST COST THAT TAB, NOT THE WHOLE DOCK.
 *
 * ── WHY THIS TAB SPECIFICALLY ─────────────────────────────────────────────
 * `ResultsBody` — the existing Analysis surface — wraps its sections in 25
 * separate `SectionErrorBoundary`s, so a failure there degrades one region and
 * the rest of the panel keeps working. `OutputsDock` had no boundary anywhere,
 * and mounted `AnalysisNewTabBody` bare. So a single throw inside the
 * experimental tab unmounted the ENTIRE dock — Olumi, Analysis, Model, every
 * tab — not just the tab that failed.
 *
 * That is worse here than the raw blast radius suggests. This is the surface
 * being evaluated, so it is the one most likely to throw; a blank dock is
 * indistinguishable from a broken build; and it takes the working tabs down
 * with it, removing the very comparison the tab exists to enable.
 *
 * ⚠ THE HARNESS MUST BE ABLE TO SEE THE DEFECT. `AnalysisNewTabBody` is
 * replaced by a component that throws on render, and nothing else is changed.
 * Without the boundary these cases fail at `getByTestId` for the tab strip
 * itself, because the strip is gone too — which is precisely the point.
 *
 * React logs the caught error to `console.error`; that is expected here and is
 * silenced so a passing run does not read as a failing one.
 */
import '@testing-library/jest-dom/vitest'

// The tab body is replaced by a component that throws on render. Nothing else
// about the dock changes, so anything that survives is the boundary working
// rather than the harness being lenient.
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({
  AnalysisNewTabBody: () => {
    throw new Error('deliberate throw from the Analysis (New) tab body')
  },
}))
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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

import { OutputsDock } from '../OutputsDock'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { ToastProvider } from '../../ToastContext'

const NEW_TAB = 'outputs-dock-tab-analysisNew'
const OLD_TAB = 'outputs-dock-tab-results'

/**
 * The Analysis surface must render at least this many testid-bearing elements
 * for the preservation comparison to mean anything. Measured at the tip this
 * spec was written against; a floor, not a pin, so ADDING to the Analysis tab
 * in a later change does not RED this file — only stubbing it into nothing does.
 */

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

describe('a throw in Analysis (New) is contained to that tab', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the dock and its tab strip alive when the tab body throws', () => {
    renderDock()

    // Precondition: the sibling tab is present BEFORE we go anywhere near the
    // throwing one, so a later assertion measures survival rather than an
    // absence that was always there.
    expect(screen.getByTestId(OLD_TAB)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(NEW_TAB))

    // The dock is still here. Without the boundary this is where the whole
    // tree has gone and every one of these queries returns null.
    expect(screen.getByTestId(NEW_TAB)).toBeInTheDocument()
    expect(screen.getByTestId(OLD_TAB)).toBeInTheDocument()
    expect(screen.getByTestId('dock-collapse-control')).toBeInTheDocument()
  })

  it('the throw really did happen — the tab body is not on screen', () => {
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))

    // Pins the precondition of the case above: if the double stopped throwing,
    // "the dock survived" would be true for the wrong reason.
    expect(screen.queryByTestId('analysis-new-tab-body')).toBeNull()
    expect(vi.mocked(console.error)).toHaveBeenCalled()
  })

  it('the user can still get back to a working tab', () => {
    renderDock()
    fireEvent.click(screen.getByTestId(NEW_TAB))
    fireEvent.click(screen.getByTestId(OLD_TAB))

    // The whole value of containing the failure: the working surface is still
    // reachable, so a broken experimental tab does not end the session.
    expect(screen.getByTestId(OLD_TAB)).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-tab-body')).toBeNull()
  })
})
