/**
 * ROADMAP 2.1132 — PR3 (living workspace): the assistant's LIVE workspace
 * gestures say so, on the surface that actually fires.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────────
 * CEE has emitted `ui_directive` blocks on real turns since #660, and since
 * #939 (CEE staging `dbd012eb`) it emits `verb: open_section, source: "gate"`
 * on blocked-analysis questions, so the panel gestures fire MORE often. The
 * UI's five-verb dispatcher (`applyV5State.ts`, the `ui_directive` branch)
 * executes them: `open_panel` → `forceActivateOutputTab(tab)`, `open_section`
 * → `requestModelTabSection(section)` + `forceActivateOutputTab('diagnostics')`.
 *
 * The dock therefore FRONTS ITSELF and SWITCHES TAB under the user, with **zero
 * attribution of any kind**. Measured at this tip before the fix: `rg -a
 * 'Opened by Olumi' src/` → 0 files, while the contrast control
 * `overlaySurfaceOrigin` → 4 files (so the sweep could see a presence).
 * The workspace appears to move on its own.
 *
 * PR #646 built an attribution badge for this harm but bound it to
 * `requestOverlaySurface`, which has ZERO production call sites and no wire
 * verb — trap 16-inverse, the code path is live and the producer cannot feed
 * it. This file binds to the path the producer DOES feed.
 *
 * ── WHAT THE NOTICE MAY SAY, AND WHY IT SAYS SO LITTLE ────────────────────────
 * `ui_directive.note` is the block's ONLY free-text field and CEE NEVER SETS
 * IT: derived at CEE staging tip `dbd012ebb24ffd7c3a4fd121664595111deb98e9`,
 * `rg -a 'note:' src/orchestrator-v5/compose/ui-directive.ts` → 0, contrast
 * control `rg -a 'source:'` → 4 (non-zero, so the probe was not blind). No
 * rationale is reachable on the wire, so the notice states ONLY the fact that
 * the assistant opened something. A plausible-sounding reason on the one
 * channel whose entire purpose is truthfulness is worse than no notice.
 *
 * It also does not NAME the surface, and that is a correctness requirement,
 * not brevity: `open_panel` at a flag-disabled tab is REDIRECTED to 'results'
 * by the E1 sync effect (`OutputsDock.tsx` `resolvedTab`), so a notice naming
 * the requested tab would name a tab the user is not looking at. Test
 * `HONESTY-2` pins exactly that case.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE (trap 3) ──────────────────────────────
 * jsdom proves PRESENCE, MOUNT PATH, TEXT, CLEARING and FOCUS BEHAVIOUR. It
 * cannot prove VISIBILITY, contrast or layout — no paint. A staging witness is
 * owed separately and is not claimed here.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

// Harness mirrors OutputsDock.overlayOcclusion.spec.tsx — the sibling spec for
// the same panel-directive seam: real dock, real canvas + ui stores, heavy
// children stubbed. Nothing about the attribution rule is mocked.
const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
  mockIsJourneyTabEnabled,
  mockIsCompareTabEnabled,
  mockIsAiPanelV2Enabled,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
  // ⚠ TRAP 3b — THESE DEFAULTS ARE THE DEPLOYED POSTURE, NOT A CONVENIENCE.
  // Derived 13 Aug 2026 from `netlify.toml` `[context.staging.environment]`
  // AND from a live DOM capture of https://staging--olumi.netlify.app
  // (`dist/version.json` commit f2b48fc99c3dff5b46f37f53be2c6190aca23f0e —
  // the same tip this branch forks from). The deployed tab strip read
  // ["Olumi","Analysis","Alt view","Compare","Model"]: aiPanelV2 ON,
  // compareTab ON, journeyTab OFF. `MOUNT-1` asserts that exact strip, so if
  // a flag moves under this spec the binding fails LOUD instead of quietly
  // testing a component the deployment does not render.
  mockIsJourneyTabEnabled: vi.fn(() => false),
  mockIsCompareTabEnabled: vi.fn(() => true),
  mockIsAiPanelV2Enabled: vi.fn(() => true),
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
    isJourneyTabEnabled: mockIsJourneyTabEnabled,
    isCompareTabEnabled: mockIsCompareTabEnabled,
    isAiPanelV2Enabled: mockIsAiPanelV2Enabled,
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

// The directive path under test is driven through the REAL applicator with a
// REAL envelope shape, never by calling `forceActivateOutputTab` by hand — the
// attribution has to hold for what the producer actually sends (trap 16: a
// fixture you wrote yourself is not evidence about the wire; here the fixture
// is at least routed through the same consumer the wire reaches).
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import type { OlumiResponse } from '@talchain/schemas/boundary'

/** The one string this notice is allowed to say. Pinned as a literal here AND
 *  in the component — a shared constant would let a rename drift both at once
 *  and keep the suite green (trap 12: a mirror that cannot fail loud). */
const NOTICE_TEXT = 'Opened by Olumi'

/** Words that would constitute an INVENTED rationale — nothing on the 0.39.0
 *  wire can justify any of them. Hand-written from outside the component
 *  author's head-model of "what the copy says" (trap 22): the point is not
 *  that today's copy avoids them, it is that a later edit adding one REDs. */
const FABRICATION_CORPUS = [
  'because',
  'so that',
  'to help',
  'we think',
  'you asked',
  'relevant',
  'recommend',
  'suggest',
  'important',
  'best',
  'should',
]

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

/** One envelope carrying one `open_panel` directive at the named tab. */
function openPanelEnvelope(tabId: string): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      { type: 'ui_directive', verb: 'open_panel', targets: [], ui_target: { kind: 'tab', id: tabId } },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  } as unknown as OlumiResponse
}

/** One envelope carrying one `open_section` directive — the shape CEE #939's
 *  gate-remedy builder emits, `source: 'gate'` and NO `note`. */
function openSectionEnvelope(sectionId: string): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      {
        type: 'ui_directive',
        verb: 'open_section',
        targets: [],
        ui_target: { kind: 'model_section', id: sectionId },
        source: 'gate',
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  } as unknown as OlumiResponse
}

function driveDirective(envelope: OlumiResponse) {
  let result: ReturnType<typeof applyV5State> | undefined
  act(() => {
    result = applyV5State(envelope, makeApplicatorStore())
  })
  // The applicator's own truthful record of what it executed. Binding to this
  // (rather than to a store field a consumer may already have drained) keeps
  // the precondition pinned in-test: the notice is not decoration on a no-op.
  return result as ReturnType<typeof applyV5State>
}

/** The tab's own label text, excluding the freshness icons and the
 *  verify-count badge that render as siblings inside the same span. Reading
 *  `button.textContent` would fold the badge count into the label ('Model1')
 *  and make this assertion depend on unrelated canvas state. */
function tabLabels(strip: HTMLElement): (string | undefined)[] {
  return Array.from(strip.querySelectorAll('button')).map((b) =>
    b.querySelector('span')?.firstChild?.textContent?.trim(),
  )
}

const notice = () => screen.queryByTestId('assistant-opened-notice')

describe('ROADMAP 2.1132 — the assistant attributes the panel gestures it actually fires', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    mockIsJourneyTabEnabled.mockReturnValue(false)
    mockIsCompareTabEnabled.mockReturnValue(true)
    mockIsAiPanelV2Enabled.mockReturnValue(true)
    seedCompletedRun()
    useUIStore.setState({
      activeRightPanel: null,
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
      pendingModelTabSection: null,
      outputSurfaceOrigin: null,
      outputSurfaceOriginSeq: 0,
    } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    useUIStore.setState({
      activeRightPanel: null,
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
      pendingModelTabSection: null,
      outputSurfaceOrigin: null,
      outputSurfaceOriginSeq: 0,
    } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  // ── MOUNT PATH (trap 3b) ────────────────────────────────────────────────────
  // A green suite about a component the deployed flags do not mount is not
  // evidence. These two tests assert the DEPLOYED posture and the DOM ANCESTRY,
  // so a flag move or a relocation REDs here rather than silently hollowing
  // every capability test below.

  it('MOUNT-1: the deployed flag posture is the one under test, and the notice mounts inside the dock header that fires', () => {
    renderDock()
    // Positive control (trap 13): the harness can SEE the header furniture
    // before anything below asserts a presence or an absence inside it.
    const strip = screen.getByRole('navigation', { name: 'Outputs sections' })
    expect(strip).toBeInTheDocument()
    expect(tabLabels(strip)).toEqual(['Olumi', 'Analysis', 'Alt view', 'Compare', 'Model'])

    // Absent before any gesture — so the presence below is the gesture's doing.
    expect(notice()).not.toBeInTheDocument()

    driveDirective(openPanelEnvelope('diagnostics'))

    const el = screen.getByTestId('assistant-opened-notice')
    // ANCESTRY, by identity — not "somewhere in the document". The notice must
    // live inside the dock, in the same sticky header as the tab strip it
    // explains. `contains` on the header proves adjacency, not just presence.
    const dock = screen.getByTestId('outputs-dock')
    expect(dock).toContainElement(el)
    expect(strip.parentElement?.parentElement).toContainElement(el)
  })

  it('MOUNT-2: the notice does not depend on the optional tab flags — it mounts under the minimal posture too', () => {
    // If a flag moved and switched the notice off, MOUNT-1 alone could not tell
    // us: it pins one posture. This pins the other end of the range.
    mockIsJourneyTabEnabled.mockReturnValue(false)
    mockIsCompareTabEnabled.mockReturnValue(false)
    mockIsAiPanelV2Enabled.mockReturnValue(false)
    renderDock()
    const strip = screen.getByRole('navigation', { name: 'Outputs sections' })
    expect(tabLabels(strip)).toEqual(['Analysis', 'Alt view', 'Model'])

    driveDirective(openPanelEnvelope('results'))
    expect(screen.getByTestId('outputs-dock')).toContainElement(
      screen.getByTestId('assistant-opened-notice'),
    )
  })

  // ── CAPABILITY ──────────────────────────────────────────────────────────────

  it('CAP-1: a real open_panel directive raises the notice', () => {
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
  })

  it('CAP-2: a real open_section directive (the CEE #939 gate shape) raises the notice', () => {
    renderDock()
    const result = driveDirective(openSectionEnvelope('relationships'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    // The gesture really did both halves — the notice is not decoration on a
    // no-op (trap 13b: a guard whose precondition nothing pins).
    //
    // ⚠ Bound to the applicator's `applied` record, NOT to
    // `pendingModelTabSection`: `ModelTabBody` DRAINS that field the moment the
    // Model tab renders (`requestModelTabSection(null)`, ModelTabBody.tsx), so
    // reading it after render measures the consumer, not the gesture. Measured
    // here: it reads null by the time this line runs.
    expect(result.applied).toContain('ui_directive:open_section:relationships')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
  })

  it('CAP-3: the user opening a tab themselves raises NO notice', () => {
    renderDock()
    fireEvent.click(screen.getByTestId('outputs-dock-tab-diagnostics'))
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(notice()).not.toBeInTheDocument()
  })

  it('CAP-4: a non-assistant programmatic force-activate (Dock-back / reveal-Olumi) raises NO notice', () => {
    renderDock()
    act(() => {
      // The exact call `revealOlumi.ts` and `ReactFlowGraph`'s Dock-back make.
      useUIStore.getState().forceActivateOutputTab('olumi')
    })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(notice()).not.toBeInTheDocument()
  })

  // ── HONESTY ─────────────────────────────────────────────────────────────────

  it('HONESTY-1: the notice states only that Olumi opened it — no rationale the wire cannot carry', () => {
    renderDock()
    driveDirective(openSectionEnvelope('relationships'))
    const el = screen.getByTestId('assistant-opened-notice')
    const text = (el.textContent ?? '').toLowerCase()
    expect(el).toHaveTextContent(NOTICE_TEXT)
    for (const word of FABRICATION_CORPUS) {
      expect(text).not.toContain(word)
    }
    // The copy is EXACTLY the pinned sentence — nothing may accrete without
    // this test going red. (The dismiss control is icon-only with an
    // `aria-label`, so it contributes no text content.)
    expect((el.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(NOTICE_TEXT)
  })

  it('HONESTY-2: a directive at a flag-disabled tab is redirected, and the notice still cannot mis-name the surface', () => {
    // journeyTab is OFF in the deployed posture, so `resolvedTab` redirects
    // 'journey' → 'results'. A notice naming the REQUESTED tab would name a tab
    // the user is not looking at.
    renderDock()
    driveDirective(openPanelEnvelope('journey'))
    const redirected = (screen.getByTestId('assistant-opened-notice').textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    expect(useUIStore.getState().activeOutputTab).toBe('journey')
    // …and the dock resolved it away from the disabled tab.
    expect(screen.getByTestId('outputs-dock-tab-diagnostics')).toBeInTheDocument()
    expect(screen.queryByText('Journey')).not.toBeInTheDocument()
    expect(redirected).toBe(NOTICE_TEXT)
  })

  // ── CLEARING — the notice must never outlive the fact ───────────────────────

  it('CLEAR-1: the user changing tab clears the notice (it does not latch)', () => {
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('outputs-dock-tab-olumi'))
    expect(notice()).not.toBeInTheDocument()
  })

  it('CLEAR-2: the notice is dismissible, and stays gone for that gesture', () => {
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(notice()).not.toBeInTheDocument()
    expect(useUIStore.getState().outputSurfaceOrigin).toBeNull()
  })

  it('CLEAR-3: the notice self-clears after its transient window', () => {
    vi.useFakeTimers()
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(9000)
    })
    expect(notice()).not.toBeInTheDocument()
  })

  it('CLEAR-4: a later gesture re-raises the notice after a dismissal', () => {
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(notice()).not.toBeInTheDocument()
    driveDirective(openSectionEnvelope('relationships'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
  })

  // ── THE STAMP MUST NOT SURVIVE AN UNMOUNT (review FIX-FIRST, 14 Aug 2026) ──
  //
  // My own harvest report called this "honest and left alone". It is NOT
  // honest, and the reviewer proved it by execution. `toggleOpen`
  // (OutputsDock.tsx) never touches uiStore — it only flips local `isOpen`.
  // Because the notice is mounted under `{effectiveIsOpen && …}`, collapsing
  // the dock UNMOUNTS it, and the effect cleanup kills the 8s timeout WITHOUT
  // clearing the store stamp. The stamp then outlives its own window
  // indefinitely, and the next time the dock is opened — BY THE USER — the
  // notice claims Olumi opened it.
  //
  // The invariant was already written down, in this feature's own store
  // doctrine (`uiStore.ts`: "NOT A LATCH … a provenance flag that outlives the
  // fact tells the user Olumi opened something they opened themselves"). The
  // enumeration beneath it simply omitted the unmount path. A stated invariant
  // with an incomplete clearing list is exactly trap 22's shape: the rule was
  // right, its BREADTH was never checked.

  it('UNMOUNT-1: collapsing the dock and re-expanding it shows NO notice (the user opened that)', () => {
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()

    // The user collapses the dock — their action, their dock.
    fireEvent.click(screen.getByRole('button', { name: 'Collapse outputs dock' }))
    expect(notice()).not.toBeInTheDocument()

    // …and re-expands it THEMSELVES.
    fireEvent.click(screen.getByRole('button', { name: 'Expand outputs dock' }))
    expect(notice()).not.toBeInTheDocument()
  })

  it('UNMOUNT-2: the stamp does not outlive its own transient window while the dock is collapsed', () => {
    // The reviewer's PROBE-B: origin still 'assistant' long after the window
    // should have expired, because the only thing that clears it died with the
    // component. Bound to the STORE, because that is where the lie is stored.
    renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(useUIStore.getState().outputSurfaceOrigin).toBe('assistant')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse outputs dock' }))
    expect(useUIStore.getState().outputSurfaceOrigin).toBeNull()
  })

  it('UNMOUNT-3: a stamp older than its window never shows again, on any remount path', () => {
    // The residual I found by probing AFTER the reviewer's fix landed: a full
    // unmount/remount (leaving the canvas and coming back) calls no
    // `toggleOpen`, so the toggleOpen clear cannot reach it. Measured at that
    // point: `outputSurfaceOrigin` read 'assistant' after the component was
    // gone, and the notice REAPPEARED on remount. Same lie, different door.
    //
    // The window is now derived from the stamp's timestamp, so it expires on
    // schedule whatever is or is not mounted.
    vi.useFakeTimers()
    const view = renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()

    // Leave the canvas entirely — nothing calls toggleOpen.
    view.unmount()
    // Time passes with NOTHING mounted: no component, so no live timer.
    act(() => {
      vi.advanceTimersByTime(9000)
    })
    // Come back.
    renderDock()
    expect(notice()).not.toBeInTheDocument()
    expect(useUIStore.getState().outputSurfaceOrigin).toBeNull()
  })

  it('UNMOUNT-4: a remount INSIDE the window inherits the remainder rather than restarting it', () => {
    // The other half of deriving the window: a remount must not hand the user
    // a fresh 8 seconds it has not earned.
    vi.useFakeTimers()
    const view = renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    view.unmount()
    renderDock()
    // 2s of the window remain, so it is still up…
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    // …and it expires on the ORIGINAL schedule, not 8s from the remount.
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(notice()).not.toBeInTheDocument()
  })

  // ── A MOVING CLOCK MUST NOT EXTEND THE WINDOW (re-review, 14 Aug 2026) ─────
  //
  // Deriving the window from a timestamp closed the unmount doors, but it also
  // made the notice depend on the WALL CLOCK, and the wall clock moves
  // backwards in this product's normal life: NTP steps, laptop suspend/resume,
  // a user correcting their clock — all reachable in a long-lived SPA.
  //
  // The arithmetic failed OPEN, which is the opposite of what this module's own
  // header promises ("null is the FAIL-CLOSED default in every direction"):
  // a negative `elapsed` makes `remaining = max(0, 8000 - elapsed)` GROW, so an
  // hour-long backward step left the notice up for an hour, attributing a
  // gesture no user could still remember. Negative elapsed means the stamp
  // cannot be trusted, so it now counts as expired.

  it('CLOCK-1: a BACKWARD clock step does not extend the window — the notice fails closed', () => {
    vi.useFakeTimers()
    const view = renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(screen.getByTestId('assistant-opened-notice')).toBeInTheDocument()
    view.unmount()

    // NTP step / suspend-resume / manual correction: the clock goes BACK an hour.
    vi.setSystemTime(new Date(Date.now() - 60 * 60 * 1000))

    renderDock()
    expect(notice()).not.toBeInTheDocument()
    expect(useUIStore.getState().outputSurfaceOrigin).toBeNull()
  })

  it('CLOCK-2: a stamp dated in the FUTURE is treated as expired, not as fresh for minutes', () => {
    vi.useFakeTimers()
    const origin = Date.now()

    // The gesture is stamped while the clock is running an hour FAST…
    vi.setSystemTime(new Date(origin + 60 * 60 * 1000))
    const view = renderDock()
    driveDirective(openPanelEnvelope('diagnostics'))
    expect(useUIStore.getState().outputSurfaceOriginAt).toBe(origin + 60 * 60 * 1000)
    view.unmount()

    // …and is then corrected, leaving a stamp an hour in the future.
    vi.setSystemTime(new Date(origin))

    renderDock()
    expect(notice()).not.toBeInTheDocument()
    expect(useUIStore.getState().outputSurfaceOrigin).toBeNull()
  })

  // ── IT MUST NOT GET IN THE WAY ──────────────────────────────────────────────

  it('NONBLOCKING-1: the notice never takes focus, and announces politely', () => {
    renderDock()
    const before = document.activeElement
    driveDirective(openPanelEnvelope('diagnostics'))
    const el = screen.getByTestId('assistant-opened-notice')
    expect(document.activeElement).toBe(before)
    expect(el).not.toContainElement(document.activeElement as HTMLElement)
    // A polite live region announces to a screen-reader user without
    // interrupting them or moving the caret.
    expect(el).toHaveAttribute('role', 'status')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })
})
