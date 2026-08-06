/**
 * ROADMAP 2.639 (`UI-DIRECTIVE-0.38-DESIGN-2026-08-06.md` slice A) — a panel
 * `ui_directive` must not open a panel the user cannot see.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────────
 * The dock hides itself with a `hidden` class on its `<aside>` whenever an
 * overlay right-panel is active — `isOverlayPanelActive = activeRightPanel ===
 * 'provenance' || activeRightPanel === 'clarifier'` (OutputsDock.tsx). `hidden`
 * is `display: none`, so the whole dock is off-screen.
 *
 * Two programmatic-navigation paths front a dock tab, and only ONE of them
 * cleared the overlay:
 *  · AUTO-DOCK cleared it — `useUIStore.getState().openRightPanel('results')`,
 *    commented in place as "Task F: Auto-open results — close overlay panels so
 *    OutputsDock becomes visible".
 *  · The E1 EXTERNAL-SYNC EFFECT, which is what the 0.32.0 panel verbs
 *    (`open_panel` / `open_section`) ride via `forceActivateOutputTab`, did NOT.
 *
 * So with the provenance or clarifier hub open, the assistant would execute the
 * directive, `activeOutputTab` would move, the dock would switch tab — behind
 * `display: none`. The turn reports success and the user sees nothing move.
 * That is worse than a no-op: the AI's one agency affordance silently fails in
 * exactly the state a user reaches by asking where a number came from.
 *
 * ── SCOPE, AND WHY IT IS NARROW ───────────────────────────────────────────────
 * Clearing the overlay is a claim on the user's screen, so it fires only on the
 * VERSION-COUNTER path (`forceActivateOutputTab`) — auto-dock, Dock-back, and
 * the two panel directives, i.e. programmatic navigation that has already
 * decided to front the dock. Plain `setActiveOutputTab` consumers are untouched:
 * `setActiveOutputTab` does not bump `activeOutputTabVersion` (uiStore.ts), and
 * a value-only sync must never yank a hub the user opened themselves.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE (trap 3) ──────────────────────────────
 * jsdom proves the STORE TRANSITION and the CLASS. It cannot prove VISIBILITY —
 * no layout, no paint. The staging witness (provenance hub open → panel-directive
 * turn → dock visibly fronted) is owed separately and is not claimed here.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

// Harness mirrors OutputsDock.announcerPlacement.spec.tsx — the sibling spec
// for the same `hidden`-class seam: real dock, real canvas + ui stores, heavy
// children stubbed. Nothing about the overlay rule is mocked.
const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
}))

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
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: mockIsV5Eligible,
    isV5CanonicalRunPath: () =>
      flags.isV5CanonicalAnalysisEnabled() &&
      mockIsV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible,
  }
})

vi.mock('../../hooks/useV2Run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useV2Run')>()
  return { ...actual, useV2Run: () => mockUseV2Run() }
})

vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ToastContext')>()
  return {
    ...actual,
    useShowToast: () => mockShowToast,
    useShowToastSafe: () => mockShowToast,
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

// The directive path under test, driven through the REAL applicator rather
// than by calling `forceActivateOutputTab` by hand — the fix has to hold for
// what the producer actually sends, not for a call we chose to make (trap 16:
// a fixture you wrote yourself is not evidence about the wire).
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import type { OlumiResponse } from '@talchain/schemas/boundary'

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

const fakeReport: Record<string, unknown> = {
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
}

function seedCompletedRun() {
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    results: { ...baseResults, status: 'complete', progress: 100, report: fakeReport },
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    analysisFreshnessDirty: false,
    showDraftChat: false,
  } as never)
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

function makeApplicatorStore(): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    goalConstraints: null,
    nodes: [],
    edges: [],
  }
}

/**
 * One envelope carrying one `open_panel` directive at the named tab — the exact
 * block shape `applyV5State`'s panel-verb branch consumes.
 */
function panelDirectiveEnvelope(tabId: string): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      {
        type: 'ui_directive',
        verb: 'open_panel',
        targets: [],
        ui_target: { kind: 'tab', id: tabId },
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  } as unknown as OlumiResponse
}

const dockIsHidden = () =>
  screen.getByTestId('outputs-dock').classList.contains('hidden')

describe('ROADMAP 2.639 — a panel directive is not executed behind an overlay', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    seedCompletedRun()
    useUIStore.setState({
      activeRightPanel: null,
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
    } as never)
  })

  afterEach(() => {
    useUIStore.setState({
      activeRightPanel: null,
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
    } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  // ── Trap 3b: bind to the surface that actually mounts ──────────────────────
  // "OutputsDock is always rendered" is a COMMENT in ReactFlowGraph.tsx. This
  // asserts it at the DOM: the aside exists even while an overlay hides it, so
  // every `hidden`-class assertion below is about a node that is really there.
  // Without this, `queryByTestId(...)` returning null would make the
  // not-hidden assertions pass by finding nothing.
  it('MOUNT PATH: the dock aside is in the DOM even while an overlay is active', () => {
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })
    expect(screen.getByTestId('outputs-dock')).toBeInTheDocument()
    // Positive control for the whole file (trap 13): prove the harness can SEE
    // the hidden state before any test asserts its absence.
    expect(dockIsHidden()).toBe(true)
  })

  // ── The two states the row names ───────────────────────────────────────────
  it.each(['provenance', 'clarifier'] as const)(
    'an open_panel directive clears the %s overlay so the dock it fronts is visible',
    (overlay) => {
      renderDock()
      act(() => {
        useUIStore.setState({ activeRightPanel: overlay } as never)
      })
      // Precondition, pinned in-test: the overlay really is occluding the dock.
      // A fixture that stopped reproducing the occlusion would otherwise leave
      // the assertions below passing for the wrong reason (trap 13b).
      expect(dockIsHidden()).toBe(true)

      act(() => {
        applyV5State(panelDirectiveEnvelope('compare'), makeApplicatorStore())
      })

      expect(useUIStore.getState().activeRightPanel).toBe('results')
      expect(dockIsHidden()).toBe(false)
    },
  )

  it('the directive still does its own job — the requested tab is fronted, not just the overlay closed', () => {
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })

    act(() => {
      applyV5State(panelDirectiveEnvelope('diagnostics'), makeApplicatorStore())
    })

    // Binding by IDENTITY to the tab the directive named (trap 19): "the
    // overlay closed" is satisfied by any number of wrong behaviours, so the
    // requested tab is asserted too.
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(dockIsHidden()).toBe(false)
  })

  it('a re-request of the SAME tab still clears the overlay — the version counter is the trigger, not a value diff', () => {
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })
    // `activeOutputTab` is already 'results', so nothing about the VALUE
    // changes here. This is the dock-reopen contract the version counter exists
    // for, and it is the case a value-diff-only fix would silently miss.
    act(() => {
      applyV5State(panelDirectiveEnvelope('results'), makeApplicatorStore())
    })

    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeRightPanel).toBe('results')
    expect(dockIsHidden()).toBe(false)
  })

  // ── The scoping half. This is the discriminating case: without it, "clear the
  //    overlay on any external tab sync" would pass every test above while
  //    yanking a hub the user opened for themselves. ─────────────────────────
  it('SCOPING: a plain setActiveOutputTab does NOT close the user’s overlay', () => {
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })
    expect(dockIsHidden()).toBe(true)

    act(() => {
      // Not a force-activate: `setActiveOutputTab` leaves
      // `activeOutputTabVersion` untouched (uiStore.ts), which is exactly the
      // signal the fix keys off.
      useUIStore.getState().setActiveOutputTab('diagnostics')
    })

    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().activeRightPanel).toBe('provenance')
    expect(dockIsHidden()).toBe(true)
  })

  it('SCOPING: with no overlay open, a directive does not invent one', () => {
    renderDock()
    expect(useUIStore.getState().activeRightPanel).toBeNull()

    act(() => {
      applyV5State(panelDirectiveEnvelope('compare'), makeApplicatorStore())
    })

    // 'results' is the dock mode, i.e. "no overlay" as far as the aside is
    // concerned — what must never happen is the dock going hidden.
    expect(dockIsHidden()).toBe(false)
  })
})
