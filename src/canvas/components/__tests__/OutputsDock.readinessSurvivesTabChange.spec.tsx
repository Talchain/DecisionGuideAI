/**
 * THE ADVICE MUST NOT DESTROY ITS OWN CONTEXT.
 *
 * ── THE WITNESS (fresh guest, real headful Chrome, 20 Aug 2026, UI `7153fbd7`) ─
 * With the run blocked, the Analysis footer prints, verbatim:
 *
 *     "4 parts of your model are not ready for analysis yet.
 *      Ask in the chat what they need."
 *
 * Selecting the Olumi tab — doing exactly what the product just said — takes
 * both the sentence and the `Analyse first pass` control OUT OF THE DOM.
 * `OutputsDock.tsx` renders the entire pre-analysis subtree under
 * `{effectiveActiveTab === 'results' && …}`, a bare conditional render, while
 * the sibling Olumi subtree is kept mounted and merely `hidden`. The user
 * arrives in the chat with nothing on screen saying what they came to ask
 * about, and no control to run once the answer lands.
 *
 * ── WHY jsdom CAN PIN THIS AND WHAT IT STILL CANNOT (trap 3) ───────────────
 * The button is PRESENT until the tab changes, so no presence assertion taken
 * at one moment can see this defect: a spec that rendered the dock and found
 * the control would have passed happily while this shipped. What is pinned here
 * is therefore a POSTCONDITION ACROSS A TAB CHANGE — the same mounted dock,
 * before and after a click on the Olumi tab, with the store untouched in
 * between. That is a claim about MOUNTING, which is exactly what jsdom is
 * authoritative about. It is not a claim about pixels, layout or the fold; the
 * live witness above owns those.
 *
 * ── THE MOUNT PATH IS ASSERTED, NOT ASSUMED ───────────────────────────────
 * This estate has twice shipped a feature dark because its tests targeted a
 * component the deployed flag posture does not render. So `MOUNT PATH` below
 * asserts the posture itself — `aiPanelV2` at its production default (ON,
 * `netlify.toml:57`), `preAnalysisV3` forced ON (`netlify.toml:161`), Olumi
 * genuinely `presentedAsTab`, and the surface's own `footerBar` declaration —
 * so the whole file REDs loudly if a flag or a declaration moves, rather than
 * passing against a surface no user loads.
 *
 * Every element is bound by `data-testid` — identity, never a value predicate
 * another element could satisfy.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import type { ConversationMessage } from '../../conversation/types'

// ---------------------------------------------------------------------------
// Heavy-import stubs — must precede any OutputsDock evaluation. Layout mirrors
// OutputsDock.runReturnsToOlumi.spec.tsx (the established aiPanelV2 dock
// harness) crossed with OutputsDock.canonicalReadinessWiring.spec.tsx (the
// established readiness-gate harness).
// ---------------------------------------------------------------------------
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
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

/**
 * Flags: `importOriginal` and SPREAD, never a hand-listed factory — a factory
 * REPLACES the module and silently drops every flag it forgot (trap 12, which
 * killed 51 tests in this repo once).
 *
 * ⚠ `isAiPanelV2Enabled` IS DELIBERATELY NOT OVERRIDDEN. The Olumi tab exists
 * only under it, and its production default (ON) is part of what is under test.
 * Overriding it to `true` here would make this spec pass on a posture the file
 * asserted rather than on the one the product ships.
 */
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isCompareTabEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isOrchestratorV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: () => false,
    isPreAnalysisV3Enabled: () => true,
  }
})

const conversationBase = {
  messages: [] as ConversationMessage[],
  isThinking: false,
  longRunningHint: null as unknown,
  sendMessage: vi.fn(),
  sendSystemEvent: vi.fn(),
  sendChip: vi.fn(),
  retryLast: vi.fn(),
  patchBlockStates: new Map(),
  setPatchBlockState: vi.fn(),
  patchRejections: new Map(),
  setPatchRejection: vi.fn(),
}
vi.mock('../../conversation/useConversation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/useConversation')>()
  return { ...actual, useConversation: () => conversationBase }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { AnalysisReadinessBar } from '../workspaceShell/AnalysisReadinessBar'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { composeAnalysisBlockedReason, analysisBlockedSentences } from '../../utils/composeBlockedReason'
import { actionableBlockers } from '../../utils/canRunAnalysis'
import { FOOTER_COPY } from '../pre-analysis-v3/constants'
import { WORKSPACE_SURFACES, presentedSurfaces } from '../workspaceShell/shellContract'
import { isAiPanelV2Enabled, isPreAnalysisV3Enabled } from '../../../flags'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPTION_LABELS: Record<string, string> = {
  opt_extend: 'Extend the free trial',
  opt_hold: 'Hold the current price',
  opt_bundle: 'Bundle onboarding in',
}

/** Side-car verdict that objects without naming a cause — held in the store AND
 *  served from the stubbed transport so its own debounced refetch cannot swap
 *  the fixture out mid-assertion. */
const SIDE_CAR_OBJECTS = {
  readiness_score: 0,
  readiness_level: 'needs_work' as const,
  can_run_analysis: false,
  confidence_explanation: 'Add some nodes to get started',
  improvements: [],
}

/** ⚠ `readiness_level: 'ready'`, not an invented band. The producer's set is
 *  exactly `ready | fair | needs_work` (`useGraphReadiness.ts`,
 *  `ACCEPTED_READINESS_LEVELS`), and a fixture outside the producer's output
 *  domain proves nothing about a branch the producer can reach. */
const SIDE_CAR_AGREES = {
  readiness_score: 90,
  readiness_level: 'ready' as const,
  can_run_analysis: true,
  confidence_explanation: 'Ready',
  improvements: [],
}

function analysisState(readiness: AnalysisStateV1['readiness']): AnalysisStateV1 {
  return {
    run_state: { kind: 'never_run' },
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/** Four blockers, each scoped to a named element.
 *
 *  ⚠ THE MESSAGES ARE CEE'S OWN SPELLING (A4, 24 Aug). They were placeholders
 *  (`'no effect values'`) while the composed refusal ignored them; since A4 the
 *  refusal IS the message, so a placeholder here would put a placeholder on the
 *  surface this spec renders and assert it as the witnessed sentence. */
const FOUR_BLOCKERS: AnalysisStateV1['readiness']['blockers'] = [
  { code: 'OPTION_NOT_READY', category: 'options', message: `Choose the missing effect value for "${OPTION_LABELS.opt_extend}".`, repairability: 'user_repairable', option_id: 'opt_extend', option_label: OPTION_LABELS.opt_extend },
  { code: 'OPTION_NOT_READY', category: 'options', message: `Choose the missing effect value for "${OPTION_LABELS.opt_hold}".`, repairability: 'user_repairable', option_id: 'opt_hold', option_label: OPTION_LABELS.opt_hold },
  { code: 'OPTION_NOT_READY', category: 'options', message: `Choose the missing effect value for "${OPTION_LABELS.opt_bundle}".`, repairability: 'user_repairable', option_id: 'opt_bundle', option_label: OPTION_LABELS.opt_bundle },
  { code: 'FACTOR_NOT_READY', category: 'factors', message: 'Set the observed value for "Support headcount".', repairability: 'user_repairable', factor_id: 'f1', factor_label: 'Support headcount' },
]

function fourBlockers(): AnalysisStateV1['readiness'] {
  return {
    status: 'not_ready',
    blockers: FOUR_BLOCKERS,
  } as AnalysisStateV1['readiness']
}

/**
 * The witnessed sentence, DERIVED BY RUNNING THE PRODUCTION EXPRESSION rather
 * than re-typed or named by rung (trap 12 — a hand-copied expectation drifts
 * the first time the composer changes, and the drift reads as green).
 *
 * ⚠ It was `BLOCKED_REASON_COPY.canonicalManyBlockers(4)` until A4. That named
 * the COUNT rung, which is now the DEGRADE rather than the answer — pinning it
 * by name would have pinned the fallback and hidden the fix at exactly the
 * surface this spec renders. This expression is the one `canRunAnalysis:718`
 * evaluates, filter included.
 */
const WITNESSED_REASON = composeAnalysisBlockedReason(actionableBlockers(FOUR_BLOCKERS))

/**
 * The SAME producer sentences, unjoined — one `<li>` each in the footer.
 *
 * ⚠ `expect(footer).toHaveTextContent(WITNESSED_REASON)` NO LONGER WORKS AND
 * MUST NOT BE RESTORED. The footer renders the producer's sentences one per
 * line, and sibling `<li>` elements concatenate with NO SEPARATOR — so the
 * container's `textContent` is `"A.B."` where the joined string is `"A. B."`.
 *
 * ⛔ AND BE PRECISE ABOUT WHAT THE BYTE-IDENTITY GUARANTEE COVERS, because the
 * PR that split this rendering stated it too broadly. It holds for the ARRAY
 * and the JOINED STRING —
 *   `analysisBlockedSentences(b).join(' ') === composeAnalysisBlockedReason(b)`
 * — true by construction. **It was never a claim about rendered `textContent`.**
 * The Analyse button's `title` is still the joined string (it is built from
 * `gateBlockedSubline`, not from the DOM), which is why `:382` below is
 * unaffected.
 *
 * ⭐ Asserting each sentence INDIVIDUALLY is stronger than substring-containment
 * on one blob: a render that dropped a sentence and joined the rest would
 * satisfy the old assertion for the sentences it kept, and REDs here.
 */
const WITNESSED_SENTENCES = analysisBlockedSentences(actionableBlockers(FOUR_BLOCKERS))

function expectFooterCarriesEveryProducerSentence(footer: HTMLElement): void {
  // Pin the fixture's own discriminating power: a one-sentence corpus could not
  // observe a dropped sentence at all.
  expect(WITNESSED_SENTENCES.length).toBeGreaterThan(1)
  for (const sentence of WITNESSED_SENTENCES) {
    expect(footer).toHaveTextContent(sentence)
  }
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
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn()
  }
}

/** A decision, a goal, three options, one factor — the drafted model a fresh
 *  guest is looking at when the blocked footer appears. */
function seedCanvasWithModel() {
  const nodes = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'How do we protect retention?' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Grow retained revenue' } },
    ...Object.entries(OPTION_LABELS).map(([id, label], i) => ({
      id, type: 'option', position: { x: 10 * i, y: 0 }, data: { kind: 'option', label },
    })),
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Support headcount' } },
  ]
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    hasCompletedFirstRun: false,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    analysisFreshness: null,
    ceeAnalysisReady: {
      goal_node_id: 'g1',
      status: 'ready',
      options: Object.keys(OPTION_LABELS).map((id) => ({ id, status: 'ready' })),
    },
  } as never)
}

function seedSideCar(verdict: typeof SIDE_CAR_OBJECTS | typeof SIDE_CAR_AGREES) {
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...verdict }),
      text: async () => '',
      headers: new Headers(),
    })),
  )
  useReadinessStore.setState({
    readiness: verdict,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: null,
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConversationProvider>{children}</ConversationProvider>
    </ToastProvider>
  )
}

/** The dock's own derivation of "the Olumi tab is showing" — its wrapper drops
 *  `hidden` and flips `aria-hidden`. */
function olumiIsFronted(): boolean {
  const wrapper = screen.getByTestId('olumi-tab-wrapper')
  return !wrapper.classList.contains('hidden') && wrapper.getAttribute('aria-hidden') === 'false'
}

/** Click the Olumi tab BY IDENTITY — the strip stamps
 *  `outputs-dock-tab-${surface.id}` from the surface registry itself. */
function clickOlumiTab() {
  fireEvent.click(screen.getByTestId('outputs-dock-tab-olumi'))
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

/**
 * ⚠ EVERY SINGLETON THE TAB ARBITRATION READS IS RESET — AND THE URL IS ONE OF
 * THEM. See the note on `history.replaceState` below for the leak that was
 * actually load-bearing and how it was traced.
 */
beforeEach(() => {
  ensureMatchMedia()
  ensureScrollIntoView()
  try {
    sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
    sessionStorage.clear()
  } catch { /* jsdom quirk */ }
  // ⭐ THE URL IS A SINGLETON TOO, AND IT IS THE ONE THAT ACTUALLY LEAKED.
  // `handleTabClick` syncs the selection into a `?tab=` deep link
  // (`OutputsDock.tsx:2209-2219`, `history.replaceState`), and jsdom keeps one
  // `window.location` for the whole FILE. So the first test's click on Olumi
  // left `?tab=olumi` in the URL and EVERY later mount read it back through the
  // one-time init effect at `OutputsDock.tsx:1698` — every subsequent test
  // opened on the Olumi tab and failed on "cannot find
  // `pre-analysis-v3-analyse`", a signature with nothing to do with the defect
  // under test. Traced to that line by instrumenting where the state update was
  // QUEUED rather than where it was applied; sessionStorage and both stores
  // were provably clean at the time. A leak that turns honest assertions into
  // misattributed ones is worse than a flake — it is a spec that cannot say
  // what it measured.
  window.history.replaceState({}, '', '/')
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 } as never)
  useFloatingPanelState.setState({ isOpen: false, isMinimised: false, source: 'user' } as never)
})

afterEach(() => {
  useReadinessStore.getState().reset()
  useCanvasStore.setState({ analysisStateV1: null } as never)
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('MOUNT PATH — the surface the deployed flags actually mount', () => {
  it('the posture under test is the deployed posture, and the declaration is live', () => {
    // A flag move must RED here rather than silently retargeting every
    // assertion below at a surface no user loads.
    expect(isAiPanelV2Enabled, 'aiPanelV2 must be a real flag, not a stub').toBeTypeOf('function')
    expect(isAiPanelV2Enabled()).toBe(true)
    expect(isPreAnalysisV3Enabled()).toBe(true)
    // Olumi is genuinely offered as a tab (Compare and Journey are the live
    // counter-examples: declared, flagged, and NOT presented).
    expect(WORKSPACE_SURFACES.olumi.presentedAsTab).toBe(true)
    expect(presentedSurfaces().map(s => s.id)).toContain('olumi')
    // …and the Olumi surface is the one that asks the shell to carry readiness.
    expect(WORKSPACE_SURFACES.olumi.footerBar).toBe('readiness')
    // CONTRAST CONTROL: not every surface declares it, so "some surface does"
    // cannot satisfy the assertion above.
    expect(WORKSPACE_SURFACES.results.footerBar).toBe('none')
    expect(WORKSPACE_SURFACES.diagnostics.footerBar).toBe('reanalyse')
  })
})

describe('the witnessed defect — following the advice removes the control', () => {
  beforeEach(() => {
    seedSideCar(SIDE_CAR_OBJECTS)
    seedCanvasWithModel()
    useCanvasStore.setState({ analysisStateV1: analysisState(fourBlockers()) } as never)
  })

  it('MECHANISM — the Analysis pre-run subtree is UNMOUNTED by the tab change, not hidden', async () => {
    // Pins the mechanism itself so the fix below cannot be mistaken for having
    // changed it. If a later lane makes the results branch survive the switch,
    // this REDs and the change gets read rather than absorbed.
    render(<Wrapper><OutputsDock /></Wrapper>)

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeDisabled()
    expect(analyse).toHaveAttribute('title', WITNESSED_REASON)
    expectFooterCarriesEveryProducerSentence(screen.getByTestId('pre-analysis-v3-footer'))

    clickOlumiTab()

    expect(olumiIsFronted()).toBe(true)
    // GONE FROM THE DOM — not merely `hidden`. This is the asymmetry.
    expect(screen.queryByTestId('pre-analysis-v3-analyse')).toBeNull()
    expect(screen.queryByTestId('pre-analysis-v3-footer')).toBeNull()
  }, 30_000)

  it('THE FIX — the reason and a run control survive the tab change the advice asks for', async () => {
    // ⭐ THE POSTCONDITION. Before the fix this REDs on the first line after the
    // click: nothing on the Olumi surface carried the sentence the user was
    // just told to go and ask about.
    render(<Wrapper><OutputsDock /></Wrapper>)

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expectFooterCarriesEveryProducerSentence(screen.getByTestId('pre-analysis-v3-footer'))

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)

    const bar = screen.getByTestId('analysis-readiness-bar')
    expect(bar).toHaveAttribute('data-blocked', 'true')
    expect(bar).toHaveTextContent(FOOTER_COPY.notReady)

    // SAME SENTENCE, not merely a plausible one: the string on the chat surface
    // is the string the Analysis surface was showing a moment earlier.
    const reason = screen.getByTestId('analysis-readiness-bar-reason').textContent ?? ''
    expect(reason.length).toBeGreaterThan(20)
    expect(reason).toBe(WITNESSED_REASON)
    // ⭐ CROSS-SURFACE IDENTITY, at the granularity the two surfaces now use.
    // The footer renders the producer's sentences one per line and the bar
    // renders their JOIN, so `beforeText.toContain(reason)` can no longer hold
    // — sibling `<li>` textContent has no separator. The property it was
    // guarding is unchanged and is asserted here directly: the bar's string IS
    // the join of exactly the sentences the Analysis surface was showing, in
    // that order. That is a stronger claim than substring-containment, because
    // it pins the SET and the ORDER rather than mere presence.
    expect(reason).toBe(WITNESSED_SENTENCES.join(' '))

    // …and a run control the user can see the state of, still honest.
    const barAnalyse = screen.getByTestId('analysis-readiness-bar-analyse')
    expect(barAnalyse).toBeDisabled()
    expect(barAnalyse).toHaveAttribute('title', WITNESSED_REASON)
  }, 30_000)

  it('OLUMI STAYS MOUNTED — the fix must not be bought by unmounting the other tab', async () => {
    // The prohibition, pinned. Olumi's mount is deliberate and load-bearing
    // (ChatThread scroll + `useSmartScroll`; `OlumiTabBody` registers its
    // guidance-store callbacks with NO cleanup precisely because it survives).
    // "Consistency" in that direction is symmetry at the cost of the user.
    render(<Wrapper><OutputsDock /></Wrapper>)

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    const wrapper = screen.getByTestId('olumi-tab-wrapper')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('hidden')

    clickOlumiTab()
    expect(screen.getByTestId('olumi-tab-wrapper')).not.toHaveClass('hidden')
  }, 30_000)
})

describe('the bar is honest in both directions', () => {
  it('READY — the same control on the same surface ENABLES when the gate opens', async () => {
    // The discriminating half. A bar that were merely always-disabled decoration
    // would satisfy the blocked case above and fail here.
    seedSideCar(SIDE_CAR_AGREES)
    seedCanvasWithModel()
    useCanvasStore.setState({
      analysisStateV1: analysisState({ status: 'ready', blockers: [] } as AnalysisStateV1['readiness']),
    } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeEnabled()

    clickOlumiTab()

    const bar = screen.getByTestId('analysis-readiness-bar')
    expect(bar).toHaveAttribute('data-blocked', 'false')
    expect(bar).toHaveTextContent(FOOTER_COPY.ready)
    // No reason is claimed when nothing is refusing.
    expect(screen.queryByTestId('analysis-readiness-bar-reason')).toBeNull()

    const barAnalyse = screen.getByTestId('analysis-readiness-bar-analyse')
    expect(barAnalyse).toBeEnabled()
    expect(barAnalyse).not.toHaveAttribute('title')
  }, 30_000)

  it('POST-RUN — the bar makes NO claim once an analysis has completed', async () => {
    // The boundary that keeps this from becoming a THIRD freshness surface in
    // one dock. After a run, staleness is the freshness strip's and
    // `ReanalyseBar`'s question; a pre-run readiness claim here would be the
    // duplicate-authority defect that got `StaleAnalysisBadge` retired.
    //
    // Non-vacuous by construction: the dock is fully open on a populated canvas
    // and the Olumi tab is fronted, so the bar's absence is a decision rather
    // than a surface that never rendered.
    seedSideCar(SIDE_CAR_OBJECTS)
    seedCanvasWithModel()
    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      analysisStateV1: analysisState(fourBlockers()),
    } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    // Proof we are on the Analysis surface POST-run: the pre-run panel is gone
    // for a reason that is not "the dock failed to mount".
    await screen.findByTestId('outputs-dock-body', {}, { timeout: 20_000 })
    expect(screen.queryByTestId('pre-analysis-v3-analyse')).toBeNull()

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)
    expect(screen.queryByTestId('analysis-readiness-bar')).toBeNull()
  }, 30_000)
})

describe('the bar itself — the pre-run window is a guard, not a decoration', () => {
  /**
   * Bound directly to the component for the one input the mounted dock cannot
   * reach without fighting the first-use rail: an EMPTY canvas collapses the
   * dock to a 40px rail, so the footer region never renders and the bar's
   * absence there would be vacuous — an absence proved by looking nowhere.
   * `preRunWithModel` is the single predicate the shell hands it, so it is
   * tested where it can actually be varied.
   */
  it('renders NOTHING outside the pre-run-with-a-model window', () => {
    const { container } = render(
      <AnalysisReadinessBar
        preRunWithModel={false}
        canRun={false}
        blockedReason={WITNESSED_REASON}
        isAnalysing={false}
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('analysis-readiness-bar')).toBeNull()
  })

  it('…and DOES render inside it, on the same props (the discriminating twin)', () => {
    // Without this pair, the assertion above is satisfied by a component that
    // renders null unconditionally.
    render(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        blockedReason={WITNESSED_REASON}
        isAnalysing={false}
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )
    expect(screen.getByTestId('analysis-readiness-bar')).toHaveAttribute('data-blocked', 'true')
    expect(screen.getByTestId('analysis-readiness-bar-reason')).toHaveTextContent(WITNESSED_REASON)
  })
})

// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⭐ THE TWO SURFACES AGREE — an EQUALITY guard, not two copy assertions.
 *
 * This block exists because the first version of this PR shipped the bar with
 * its own two-arm expression beside `PanelFooter`'s four-arm ladder, and an
 * independent review drove the mounted dock into a state where they said
 * different things: with neither readiness authority having answered, the
 * Analysis footer said *"Readiness not checked yet"* (warning) while the Olumi
 * bar said *"Analysis available"* (green) — the confident claim, on the surface
 * the advice sends the user to.
 *
 * ⚠ NOTE THE DATES. The footer's `nothingHasAnswered` arm landed 19 Aug; the
 * bar landed 20 Aug. Two fixes for one harm, one day apart, each correct in
 * isolation, NEITHER ONE'S TESTS ABLE TO SEE THE OTHER. Nothing inside either
 * diff could have surfaced it.
 *
 * So these assertions are deliberately EQUALITIES between the two surfaces
 * rather than checks that each says the right thing. An equality cannot pass
 * while they disagree, and it fails loudly if either surface later grows an arm
 * the other lacks — which is exactly how this arrived. Both are read across a
 * tab change with the store untouched in between, because the results subtree
 * unmounts and the two can never be on screen at once.
 */
describe('THE TWO SURFACES AGREE — headline equality, not two copies', () => {
  it('PENDING — neither authority has answered: the same headline on both', async () => {
    // The cold-load / starvation state: the check has not answered YET and has
    // not failed. A fetch that never settles is what produces it honestly —
    // resolving gives a verdict, rejecting gives the outage arm.
    clearInflightCache()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    useReadinessStore.setState({
      readiness: null, loading: true, error: null, stale: false, verdictAtMs: null,
    })
    seedCanvasWithModel()
    useCanvasStore.setState({ analysisStateV1: null } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    // The precondition is PINNED IN-TEST: without it this could pass because
    // the state never arrived, not because the surfaces agree (trap 13b).
    expect(useReadinessStore.getState().readiness).toBeNull()
    expect(useReadinessStore.getState().error).toBeNull()
    const footerHeadline = screen.getByTestId('pre-analysis-v3-footer-headline').textContent ?? ''
    expect(footerHeadline).toBe(FOOTER_COPY.readinessPending)

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)

    const barHeadline = screen.getByTestId('analysis-readiness-bar-headline').textContent ?? ''
    // ⭐ THE EQUALITY. Written against the OTHER SURFACE, not against a constant:
    // a constant would let both drift together and still pass.
    expect(barHeadline).toBe(footerHeadline)
    // …and the specific claim that was wrong is named, so a future reader can
    // see which direction the defect ran.
    expect(barHeadline).not.toBe(FOOTER_COPY.ready)
  }, 30_000)

  it('OUTAGE — the check failed: the same headline on both, and Retry on both', async () => {
    // A network rejection is what sets `readinessStore.error` and KEEPS it set:
    // the mount fetch fails again rather than clearing it.
    clearInflightCache()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    seedCanvasWithModel()
    useCanvasStore.setState({ analysisStateV1: null } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    const outageRow = await screen.findByTestId(
      'pre-analysis-v3-readiness-outage', {}, { timeout: 20_000 },
    )
    // Precondition pinned in-test: the store really is in the failed state.
    expect(useReadinessStore.getState().error).not.toBeNull()
    expect(useReadinessStore.getState().readiness).toBeNull()
    expect(outageRow).toBeInTheDocument()
    const footerHeadline = screen.getByTestId('pre-analysis-v3-footer-headline').textContent ?? ''
    expect(footerHeadline.length).toBeGreaterThan(0)

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)

    expect(screen.getByTestId('analysis-readiness-bar-outage')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-readiness-bar-headline').textContent ?? '').toBe(
      footerHeadline,
    )
    // The gate stays OPEN through an outage (`canRunAnalysis` blocks only on
    // `readiness && !can_run_analysis`), which is exactly why the bar would
    // otherwise have rendered a green "Analysis available" here.
    expect(screen.getByTestId('analysis-readiness-bar-headline').textContent ?? '').not.toBe(
      FOOTER_COPY.ready,
    )
    // The recovery goes with the claim: the route stays usable on whichever
    // surface the user is standing on.
    expect(screen.getByTestId('analysis-readiness-bar-retry')).toBeEnabled()
  }, 30_000)

  it('BLOCKED — the gate arm too, so the guard is not pinned to the new arms alone', async () => {
    seedSideCar(SIDE_CAR_OBJECTS)
    seedCanvasWithModel()
    useCanvasStore.setState({ analysisStateV1: analysisState(fourBlockers()) } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    const footerHeadline = screen.getByTestId('pre-analysis-v3-footer-headline').textContent ?? ''
    expect(footerHeadline).toBe(FOOTER_COPY.notReady)

    clickOlumiTab()
    expect(screen.getByTestId('analysis-readiness-bar-headline').textContent ?? '').toBe(
      footerHeadline,
    )
  }, 30_000)
})

// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⭐ THE RESTING ARM — the one the ladder does NOT share, and therefore the one
 * that can still drift.
 *
 * The delta review measured the asymmetry and it ran the wrong way: making the
 * SHELL's resting headline diverge REDs (the READY test's copy assertion bites),
 * but making the PANEL's diverge SURVIVED — 11/11 green while the two surfaces
 * contradicted each other in the resting state. The guarded half is a frozen
 * constant (`RESTING_AVAILABLE`); the unguarded half is a four-branch memo that
 * has been edited repeatedly (scaffold arm, success-unset arm, estimates arm).
 *
 * That is trap 22b in miniature — one direction tested, the other open, suite
 * green throughout — and leaving it would half-close the exact defect class this
 * PR exists to close, in the change written to close it. So resting gets the
 * same equality treatment as PENDING / OUTAGE / BLOCKED, and the mutant battery
 * proves it bites in BOTH directions.
 */
describe('THE TWO SURFACES AGREE — the resting arm too', () => {
  it('RESTING — a verdict exists and nothing objects: the same headline on both', async () => {
    seedSideCar(SIDE_CAR_AGREES)
    seedCanvasWithModel()
    useCanvasStore.setState({
      analysisStateV1: analysisState({ status: 'ready', blockers: [] } as AnalysisStateV1['readiness']),
    } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    // Preconditions pinned in-test: this really is RESTING and not one of the
    // three arms above wearing its clothes (trap 13b — a guard whose
    // discrimination depends on a fixture that nothing pins).
    expect(useReadinessStore.getState().error).toBeNull()
    expect(useReadinessStore.getState().readiness).not.toBeNull()
    expect(screen.queryByTestId('pre-analysis-v3-readiness-outage')).toBeNull()
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeEnabled()

    const footerHeadline = screen.getByTestId('pre-analysis-v3-footer-headline').textContent ?? ''
    expect(footerHeadline).toBe(FOOTER_COPY.ready)

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)

    // ⭐ THE EQUALITY, against the OTHER SURFACE rather than a constant.
    expect(screen.getByTestId('analysis-readiness-bar-headline').textContent ?? '').toBe(
      footerHeadline,
    )
  }, 30_000)
})

// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⭐ ENABLE IN PLACE — the behaviour that satisfies the founder's ruling, and
 * the one the suite could not see.
 *
 * The ruling is that the route Olumi recommends must actually be usable: the
 * user is told to ask in the chat, and when the answer lands the action must be
 * there. `READY` above seeds the ready state BEFORE render, so it proves the bar
 * CAN show an enabled control — never that the control enables WITHOUT the user
 * leaving the chat. Enable-in-place was verified twice by driving it, and a
 * behaviour verified only by a reviewer's probe is not protected.
 *
 * One variable moves: the PRODUCER's verdict, which supersedes the side-car
 * (`canRunAnalysis`'s precedence). That is the real journey — the user asks,
 * Olumi repairs, the next verdict says ready — and it means the flip cannot be
 * attributed to anything else in the fixture.
 *
 * ⚠ IN PLACE IS ASSERTED BY NODE IDENTITY, not by "an enabled button exists".
 * A remount that produced a fresh enabled button would satisfy the weaker claim
 * while the user's chat surface flickered or lost its front.
 */
describe('ENABLE IN PLACE — the answer lands and the action is already there', () => {
  it('blocked in the chat → the producer answers → THE SAME button enables, Olumi never loses front', async () => {
    seedSideCar(SIDE_CAR_OBJECTS)
    seedCanvasWithModel()
    useCanvasStore.setState({ analysisStateV1: analysisState(fourBlockers()) } as never)

    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })

    clickOlumiTab()
    expect(olumiIsFronted()).toBe(true)

    const bar = screen.getByTestId('analysis-readiness-bar')
    const button = screen.getByTestId('analysis-readiness-bar-analyse')
    expect(bar).toHaveAttribute('data-blocked', 'true')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', WITNESSED_REASON)

    // The answers land. Nothing else moves — no tab click, no remount, no
    // second render call.
    act(() => {
      useCanvasStore.setState({
        analysisStateV1: analysisState({ status: 'ready', blockers: [] } as AnalysisStateV1['readiness']),
      } as never)
    })

    // ⭐ THE SAME DOM NODE. Not "a button is enabled" — THIS button.
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toBe(button)
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('title')
    expect(screen.getByTestId('analysis-readiness-bar')).toBe(bar)
    expect(bar).toHaveAttribute('data-blocked', 'false')

    // The user is still where the advice sent them, and the reason is gone
    // because there is no longer one to state.
    expect(olumiIsFronted()).toBe(true)
    expect(screen.queryByTestId('analysis-readiness-bar-reason')).toBeNull()
  }, 30_000)
})
