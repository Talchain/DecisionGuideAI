/**
 * UI — THE DOCK'S DEFAULT TAB, AND THE INTENT IT MAY NOT OVERRIDE.
 *
 * ── THE RULING (Paul, 9 Sep 2026) ───────────────────────────────────────────
 *
 * A fresh individual landed on **Analysis** — measured on the deployed build,
 * where `outputs-dock-tab-results` carried `aria-selected="true"`. Analysis is
 * the surface ruled OUT of scope. A fresh, UNCHOSEN session must land on
 * **Reasoning** (`analysisNew`).
 *
 * ⚠ AND ITS SECOND HALF, WHICH IS THE HALF A NAIVE FIX BREAKS: *preserve user
 * intent*. Default ≠ override. A restored tab, an explicit click, a `?tab=`
 * deep link and a deliberate programmatic activation all outrank the default.
 *
 * ── WHY EACH CASE EXISTS, AND WHAT IT WOULD MISS ALONE ──────────────────────
 *
 * "The dock opens on Reasoning" is one assertion and it certifies almost
 * nothing: eight `'results'` literals sat in `OutputsDock.tsx` and a change
 * that replaced all of them would pass it while silently re-pointing an
 * assistant's `open_panel` verb, discarding a restored tab, and yanking a user
 * off Analysis on every run. So the default gets ONE case and its BOUNDARY gets
 * five, each naming a different way the default could eat a choice.
 *
 * ⚠ EVERY CASE BINDS BY IDENTITY — the tab's own `data-testid` and its live
 * `aria-selected` — never "the Reasoning body is on screen". The Reasoning body
 * would also be on screen if the strip had lost its selection entirely, and
 * `analysis-new-tab-body` is a value predicate a stub could satisfy (trap 19).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import {
  DEFAULT_WORKSPACE_SURFACE,
  presentedSurfaces,
} from '../workspaceShell/shellContract'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => true,
    isJourneyTabEnabled: vi.fn(() => false),
  }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: () => ({}),
}))

vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" />,
}))

vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: () => <div data-testid="mock-results-body" />,
}))

vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({
  AnalysisNewTabBody: () => <div data-testid="mock-analysis-new-body" />,
}))

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

/**
 * A canvas with a model on it. Needed because an EMPTY canvas renders the
 * first-use rail instead of the expanded strip — a different surface with its
 * own tab ids — and every assertion here is about the expanded strip Paul
 * measured.
 */
function seedGraph() {
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun: false,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    results: { ...baseResults, status: 'idle', progress: 0, report: undefined },
    showResultsPanel: false,
    showDraftChat: false,
  } as never)
}

/** A session that has already CHOSEN a tab, persisted exactly as the dock does. */
function seedChosenTab(tab: string) {
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: tab }))
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

/** The tab actually fronted right now, read from the live tablist. */
function frontedTab(): string | null {
  const selected = document.querySelector('[role="tab"][aria-selected="true"]')
  return selected?.getAttribute('data-testid')?.replace('outputs-dock-tab-', '') ?? null
}

function startRun() {
  act(() => { useCanvasStore.getState().resultsStart({ seed: 42 }) })
}

describe('the dock opens on Reasoning when nobody has chosen (default-tab ruling, 9 Sep 2026)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    sessionStorage.clear()
    try { window.history.replaceState({}, '', '/canvas') } catch { /* jsdom */ }
    useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
    seedGraph()
  })

  afterEach(() => {
    sessionStorage.clear()
    try { window.history.replaceState({}, '', '/canvas') } catch { /* jsdom */ }
    useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
      showResultsPanel: false,
    } as never)
  })

  /**
   * ⭐ THE RULING ITSELF, ASSERTED WHERE PAUL MEASURED IT.
   *
   * PRECONDITION IN-TEST: nothing is persisted, so the value under test really
   * is the DEFAULT and not a restore. Without that assertion this case would
   * pass just as happily against a leaked `activeTab` from a previous test.
   */
  it('a fresh session with nothing persisted fronts Reasoning, not Analysis', () => {
    expect(
      sessionStorage.getItem(OUTPUTS_DOCK_STORAGE_KEY),
      'something was persisted — this case would be measuring a restore, not the default',
    ).toBeNull()

    renderDock()

    expect(frontedTab()).toBe('analysisNew')
    // Bound as an ABSENCE on the exact tab Paul measured, so the case REDs if
    // the strip ever fronts both or reverts.
    expect(screen.getByTestId('outputs-dock-tab-results')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('outputs-dock-tab-analysisNew')).toHaveAttribute('aria-selected', 'true')
  })

  /**
   * The default must be a surface the strip actually presents. A default
   * pointing at a hidden or unflagged-off surface would front a tab with no
   * control to leave it — derived from the contract rather than restated, so it
   * cannot drift from `presentedSurfaces()`.
   */
  it('the declared default is a presented surface', () => {
    expect(presentedSurfaces().map(s => s.id)).toContain(DEFAULT_WORKSPACE_SURFACE)
  })

  /**
   * ⭐ BOUNDARY 1 — A RESTORED CHOICE OUTRANKS THE DEFAULT.
   * `useDockState` reaches for the default only when sessionStorage holds
   * nothing valid, so this is the difference between "default" and "override".
   */
  it('a restored session that chose Analysis stays on Analysis', () => {
    seedChosenTab('results')
    renderDock()
    expect(frontedTab()).toBe('results')
  })

  /**
   * ⭐ BOUNDARY 2 — AN EXPLICIT CLICK OUTRANKS THE DEFAULT, AND SURVIVES.
   * The click is asserted to have MOVED the selection (it starts on the
   * default), so a strip that ignored clicks entirely could not pass this.
   */
  it('an explicit click onto Analysis is honoured and not undone', () => {
    renderDock()
    expect(frontedTab()).toBe('analysisNew')
    act(() => { screen.getByTestId('outputs-dock-tab-results').click() })
    expect(frontedTab()).toBe('results')
  })

  /**
   * ⭐ BOUNDARY 3 — A `?tab=` DEEP LINK OUTRANKS THE DEFAULT.
   */
  it('a ?tab=results deep link opens Analysis', () => {
    try { window.history.replaceState({}, '', '/canvas?tab=results') } catch { /* jsdom */ }
    renderDock()
    expect(frontedTab()).toBe('results')
  })

  /**
   * ⭐ BOUNDARY 3b — A PROGRAMMATIC ACTIVATION IS HONOURED WHEN IT NAMES A LIVE
   * SURFACE, AND TAKES THE DEFAULT ONLY WHEN IT CANNOT BE.
   *
   * This is the seam the 0.32.0 panel verbs (`open_panel` / `open_section`) ride
   * via `forceActivateOutputTab`, so it carries the sharpest version of "default
   * ≠ override": a fix that swapped the literal here without reading it would
   * make the assistant open a surface it did not name.
   *
   * BOTH ARMS ARE ASSERTED, and neither alone would show the binding. The
   * honoured arm alone passes for a pass-through that never falls back; the
   * fallback arm alone passes for a component that ignores the request entirely.
   */
  it('honours a forced activation of a live tab, and falls back to the default only for a dead one', () => {
    renderDock()
    expect(frontedTab()).toBe('analysisNew')

    // Honoured: 'results' is presented, so it is NOT remapped to the default.
    act(() => { useUIStore.getState().forceActivateOutputTab('results') })
    expect(
      frontedTab(),
      'an explicit request for Analysis was remapped — this is the assistant opening the wrong panel',
    ).toBe('results')

    // Fallback: 'journey' is hidden by contract and flagged off in this harness,
    // so there is nothing to honour and the session takes the default.
    act(() => { useUIStore.getState().forceActivateOutputTab('journey') })
    expect(frontedTab()).toBe('analysisNew')
  })

  /**
   * ⭐⭐ BOUNDARY 4 — THE RULING'S OWN JOURNEY. A RUN START MAKES NO TAB CLAIM.
   *
   * This is the case the whole change exists for: before it, a fresh user
   * landed on Reasoning, pressed Run, and was pulled onto the Analysis tab the
   * ruling had just moved them off — the ruling defeated on the one journey it
   * was written for.
   *
   * PRECONDITION IN-TEST: the run really transitions from idle, which is the
   * only shape that used to trip the auto-switch. A re-run has never tripped it
   * (`wasInactive` is false from 'complete'), so measuring a re-run here would
   * pass with the switch fully intact.
   */
  it('starting the first run does not move a fresh user off Reasoning', () => {
    renderDock()
    expect(frontedTab()).toBe('analysisNew')
    expect(useCanvasStore.getState().results.status).toBe('idle')

    startRun()

    expect(
      frontedTab(),
      'the run start navigated. It may reveal the dock; it may not choose a tab.',
    ).toBe('analysisNew')
  })

  /**
   * ⭐⭐ BOUNDARY 5 — THE OPPOSITE-DIRECTION TWIN (trap 22b).
   *
   * Boundary 4 alone is satisfied by a fix that merely RE-POINTS the auto-switch
   * at `analysisNew` — which would trade one silent yank for its mirror image,
   * pulling a user who explicitly chose Analysis onto Reasoning. A corpus that
   * tests one direction is a guard watching one door, so this case walks the
   * other way through it.
   */
  it('starting a run does not move a user who chose Analysis off Analysis', () => {
    seedChosenTab('results')
    renderDock()
    expect(frontedTab()).toBe('results')

    startRun()

    expect(
      frontedTab(),
      're-pointing the auto-switch is not the fix — it just reverses whose choice is discarded.',
    ).toBe('results')
  })

  /**
   * ⭐ THE HALF THAT WAS KEPT, PINNED SO IT CANNOT BE LOST WITH THE OTHER.
   *
   * The effect answers two questions: REVEAL the dock, and NAVIGATE to a tab.
   * Only the navigation was withdrawn. Without this case, deleting the reveal
   * as well would leave every case above green while a user watched their
   * analysis run behind a collapsed rail.
   */
  it('a run start still reveals a closed dock', () => {
    seedChosenTab('analysisNew')
    sessionStorage.setItem(
      OUTPUTS_DOCK_STORAGE_KEY,
      JSON.stringify({ isOpen: false, activeTab: 'analysisNew' }),
    )
    renderDock()
    const control = screen.getByTestId('dock-collapse-control')
    expect(
      control.getAttribute('aria-label'),
      'the dock was already expanded — this case would certify a reveal it never saw',
    ).toBe('Expand outputs dock')

    startRun()

    expect(screen.getByTestId('dock-collapse-control').getAttribute('aria-label')).toBe(
      'Collapse outputs dock',
    )
    expect(frontedTab()).toBe('analysisNew')
  })

  /**
   * ⭐ THE `showResultsPanel` TRIGGER KEEPS ITS TAB CLAIM.
   *
   * It is raised by affordances that NAME Analysis (the palette's
   * `action:results`, ⌘/Ctrl+3, a `?run=` share link) and by rehydration of the
   * `ui.showResultsPanel` preference, which the dock maintains as "open AND
   * Analysis fronted". Dropping this claim with the run-start one would break a
   * command whose entire text is "show me the results".
   */
  it('an external show-results signal still fronts Analysis', () => {
    renderDock()
    expect(frontedTab()).toBe('analysisNew')

    act(() => { useCanvasStore.getState().setShowResultsPanel(true) })

    expect(frontedTab()).toBe('results')
  })

  /**
   * `?tab=` names the surface WHEN IT IS NOT THE DEFAULT. With the delete-case
   * left on `'results'`, a link copied from the Analysis tab carried no param at
   * all and opened on Reasoning for the recipient — the sender's explicit choice
   * discarded by the address bar.
   */
  it('the URL carries the non-default tab and omits the default', () => {
    renderDock()

    act(() => { screen.getByTestId('outputs-dock-tab-results').click() })
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('results')

    act(() => { screen.getByTestId('outputs-dock-tab-analysisNew').click() })
    expect(new URLSearchParams(window.location.search).get('tab')).toBeNull()
  })
})
