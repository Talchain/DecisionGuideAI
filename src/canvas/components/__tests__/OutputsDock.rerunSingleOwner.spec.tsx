/**
 * OutputsDock — ONE Rerun owner per viewport (lane C1).
 *
 * Doctrine (Wave F-B, brief §5 / §2.2): AnalysisFreshnessNotice is the sole
 * freshness owner and carries THE one Rerun; the same action is never
 * repeated across surfaces in one viewport. This spec pins the post-run
 * Analysis-tab matrix:
 *
 *   - stale / unknown / fresh verdict → the strip renders its Rerun and the
 *     sticky AnalysisFooter is STATUS-ONLY (robustness verdict + producer
 *     meta stay; no `results-analysis-footer-action`), and no hero-side
 *     rerun exists anywhere in the tab tree;
 *   - no freshness verdict held (strip renders nothing) → the footer KEEPS
 *     its Rerun action, so the tab never loses its only recovery affordance;
 *   - no rerun offered by the strip (NON-orphan 'none' verdict) → the footer
 *     KEEPS its Rerun, pinning the `!== 'none'` clause of
 *     `freshnessStripOwnsRerun`;
 *   - orphaned result (V5 canonical flag on, no V5 fact) → the strip ALWAYS
 *     offers the one Rerun: a held fresh/stale/unknown verdict wins, and a
 *     null or 'none' verdict synthesises the cannot-confirm variant
 *     (resolveTrustEffectiveState) — the footer stays status-only, keeping
 *     its robustness status.
 *
 * VISIBILITY IS A STRUCTURAL PROXY HERE. jsdom has no layout engine, so no
 * assertion in this file can prove the sole owner is on SCREEN:
 * `getAllByRole`/`getByTestId` prove DOM PRESENCE only, and mount-parity is
 * NOT visibility-parity. (An earlier revision of this spec asserted
 * `toHaveLength(1)` under an "always-visible" comment while the sole owner
 * scrolled away — presence held, visibility did not.) The invariant that
 * makes visibility true is pinned instead by
 * `expectRerunOwnerCannotScrollAway` below.
 *
 * Scaffolding mirrors OutputsDock.testability.spec.tsx (real ResultsBody,
 * stable useConversation stub, aiPanelV2 OFF).
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { collectRerunControls } from '../../../../tests/helpers/rerunControls'

const { mockIsV5CanonicalAnalysisEnabled, mockIsAnalysisHeroV17Enabled, mockIsAnalysisHeroPanelEnabled } =
  vi.hoisted(() => ({
    mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
    mockIsAnalysisHeroV17Enabled: vi.fn(() => false),
    mockIsAnalysisHeroPanelEnabled: vi.fn(() => false),
  }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
    isLegacyDirectRunEnabled: () => false,
    isJourneyTabEnabled: () => false,
    // Legacy host path: no <ConversationProvider> needed (useConversation is
    // stubbed below) — the Results-tab surface under test is identical.
    isAiPanelV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
    isAnalysisHeroV17Enabled: mockIsAnalysisHeroV17Enabled,
    isAnalysisHeroPanelEnabled: mockIsAnalysisHeroPanelEnabled,
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }),
}))

// Stable conversation stub (shape mirrors the singleton spec's stub).
vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
    sendMessage: vi.fn(),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    retryLast: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }),
}))


// PreAnalysisPanel pulls ToastProvider + readiness fetches that fail outside
// the full app shell; post-run surface under test never renders it.
vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => null,
}))

vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
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

const fakeReport: Record<string, unknown> = {
  results: {
    conservative: 10,
    likely: 20,
    optimistic: 30,
    units: 'percent',
    unitSymbol: '%',
  },
  run: {
    bands: { p10: 10, p50: 20, p90: 30 },
  },
  robustness: {
    recommendation_stability: 0.87,
  },
}

function seedPostRun(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioFraming: null,
    currentScenarioLastResultHash: null,
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'opt-a', type: 'option', data: { label: 'Option A', kind: 'option' }, position: { x: 50, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    results: { status: 'complete', report: fakeReport },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    showDraftChat: false,
    ...overrides,
  } as never)
}

const SCROLLER_RE = /overflow-y-auto|overflow-y-scroll|(^|\s)overflow-auto(\s|$)/
const PINNED_RE = /(^|\s)(sticky|fixed)(\s|$)/

const classOf = (el: Element) => el.getAttribute('class') ?? ''

/**
 * Walk up from `control` to the nearest scrolling ancestor.
 * Returns the scroller, or null when the control sits outside every scroller.
 */
function nearestScroller(control: Element): Element | null {
  let node: Element | null = control.parentElement
  while (node && node !== document.body) {
    if (SCROLLER_RE.test(classOf(node))) return node
    node = node.parentElement
  }
  return null
}

/**
 * STRUCTURAL PROXY for "this control cannot leave the viewport".
 *
 * True when the control either (a) sits outside every scroller — like the
 * AnalysisFooter, a sibling of the scroller — or (b) is pinned inside its
 * scroller by a `sticky`/`fixed` ancestor (inclusive of itself).
 *
 * False means the control scrolls away with the content. While the footer
 * yields its action to the strip, that leaves ZERO rerun affordance on
 * screen — the exact regression this lane exists to prevent.
 */
function rerunOwnerCannotScrollAway(control: Element): boolean {
  let node: Element | null = control
  let pinned = false
  while (node && node !== document.body) {
    // Check scroller FIRST: a `sticky` class on the scroller itself pins the
    // scroller in ITS parent, and says nothing about the control inside it.
    if (SCROLLER_RE.test(classOf(node))) return pinned
    if (PINNED_RE.test(classOf(node))) pinned = true
    node = node.parentElement
  }
  return true
}

/**
 * Assert the invariant AND assert the pin is not vacuous — if the control
 * turned out to sit in no scroller at all, `rerunOwnerCannotScrollAway`
 * would pass for a reason unrelated to the fix, and the pin would rot
 * silently (the failure mode that made the old `hero-rerun` pins useless).
 */
function expectRerunOwnerCannotScrollAway(control: Element, opts: { insideScroller: boolean }) {
  if (opts.insideScroller) {
    expect(nearestScroller(control)).not.toBeNull()
  }
  expect(rerunOwnerCannotScrollAway(control)).toBe(true)
}

describe('OutputsDock — one Rerun owner per viewport (C1)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom quirk — never block the suite */
    }
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    mockIsAnalysisHeroV17Enabled.mockReturnValue(false)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(false)
  })

  it.each(['stale', 'unknown'] as const)(
    'CEE %s verdict: the strip Rerun is the ONLY rerun control — footer is status-only, no hero rerun',
    (freshness) => {
      mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
      seedPostRun({
        analysisFreshness: { freshness, computedAt: '2026-07-15T00:00:00.000Z' },
      })
      render(<OutputsDock />)

      // The strip owns recovery — its Rerun renders.
      expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', freshness)
      const stripRerun = screen.getByTestId('freshness-strip-rerun')
      expect(stripRerun).toBeInTheDocument()

      // No hero-side rerun (v6: the hero has no stale affordance of its own).
      // Re-anchored: this previously queried `hero-rerun`, a testid that
      // exists NOWHERE in source, so it asserted the absence of something
      // that could never be present and could never fail. Anchor to the
      // hero's REAL root (getByTestId throws if the hero stops rendering, so
      // the pin cannot go vacuous again) and sweep its whole subtree.
      const hero = screen.getByTestId('analysis-hero-panel')
      expect(collectRerunControls(hero).size).toBe(0)

      // The footer keeps its robustness STATUS but drops its Rerun action.
      expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
      expect(screen.getByTestId('results-analysis-footer')).toHaveTextContent('Robustness unknown')
      expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()

      // Exactly ONE rerun control in the whole tab tree — matched by name OR
      // testid, so a control reintroduced under any other spelling is caught.
      const controls = collectRerunControls(document.body as HTMLElement)
      expect([...controls]).toEqual([stripRerun])

      // ...and that sole owner cannot scroll out of the viewport.
      expectRerunOwnerCannotScrollAway(stripRerun, { insideScroller: true })
    },
  )

  it('fresh verdict: strip Rerun (parity: rerun is always legitimate) + status-only footer', () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'fresh')
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('local dirty overlay (fresh downgraded to unknown): still one owner — footer stays status-only', () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
      analysisFreshnessDirty: true,
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'unknown')
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('the sole Rerun owner is pinned against scrolling away (structural proxy — jsdom cannot see)', () => {
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
    seedPostRun({ analysisFreshness: { freshness: 'stale', computedAt: 1 } })
    render(<OutputsDock />)

    const strip = screen.getByTestId('analysis-freshness-notice')
    const stripRerun = screen.getByTestId('freshness-strip-rerun')

    // The footer has yielded its action, so the strip is the ONLY owner...
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()

    // ...and the strip really does live inside the tab's one scroller, above
    // the whole ResultsBody. Without a pin it would scroll away on the first
    // scroll and take the tab's only recovery action off screen with it.
    expect(nearestScroller(stripRerun)).not.toBeNull()

    // The pin itself: `sticky top-0` on the strip root (load-bearing — see
    // the always-visibility contract in AnalysisFreshnessNotice's header).
    expect(classOf(strip)).toMatch(/(^|\s)sticky(\s|$)/)
    expect(classOf(strip)).toMatch(/(^|\s)top-0(\s|$)/)
    // `bg-panel` is what makes the pinned strip opaque to the body scrolling
    // behind it; `z-10` is what keeps it above.
    expect(classOf(strip)).toMatch(/(^|\s)z-10(\s|$)/)
    expect(classOf(strip)).toMatch(/(^|\s)bg-panel(\s|$)/)

    expectRerunOwnerCannotScrollAway(stripRerun, { insideScroller: true })
  })

  it('structural proxy self-check: the helper FAILS an unpinned control inside a scroller', () => {
    // Guards the pin above against passing for the wrong reason. If this
    // helper cannot detect the regression on a hand-built DOM, it cannot
    // detect it on the real one either.
    const host = document.createElement('div')
    host.innerHTML = `
      <div class="flex-1 min-h-0 olumi-scrollbar overflow-y-auto px-3 py-3 space-y-6">
        <div class="rounded-md border px-3 py-2 bg-panel">
          <button data-testid="unpinned-rerun">Rerun</button>
        </div>
      </div>`
    document.body.appendChild(host)
    const unpinned = host.querySelector('[data-testid="unpinned-rerun"]')!
    expect(nearestScroller(unpinned)).not.toBeNull()
    expect(rerunOwnerCannotScrollAway(unpinned)).toBe(false)

    // Same DOM, now pinned → passes.
    host.querySelector('.bg-panel')!.classList.add('sticky', 'top-0', 'z-10')
    expect(rerunOwnerCannotScrollAway(unpinned)).toBe(true)

    // A control outside every scroller (the AnalysisFooter's shape) passes
    // without needing a pin.
    const outside = document.createElement('button')
    host.appendChild(outside)
    expect(nearestScroller(outside)).toBeNull()
    expect(rerunOwnerCannotScrollAway(outside)).toBe(true)

    host.remove()
  })

  it("CEE 'none' verdict: strip holds a verdict but offers NO rerun, so the footer keeps its action", () => {
    // Pins the `!== 'none'` clause of `freshnessStripOwnsRerun`. A verdict IS
    // held (so a `!= null`-only gate would wrongly strip the footer's action),
    // but 'none' means there is nothing to rerun and the strip draws no
    // control — the footer must therefore remain the tab's recovery owner.
    seedPostRun({ analysisFreshness: { freshness: 'none', computedAt: 1 } })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'none')
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()

    const action = screen.getByTestId('results-analysis-footer-action')
    expect(action).toBeInTheDocument()
    expect(action).toHaveTextContent('Rerun')

    // Still exactly one owner — ownership moved to the footer, it did not
    // vanish and it did not double up.
    expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([action])

    // The footer is a sibling OUTSIDE the scroller, so it is always visible
    // without needing a pin.
    expectRerunOwnerCannotScrollAway(action, { insideScroller: false })
    expect(nearestScroller(action)).toBeNull()
  })

  it('NO freshness verdict held: the strip renders nothing and the footer KEEPS its Rerun (no affordance loss)', () => {
    seedPostRun({ analysisFreshness: null })
    render(<OutputsDock />)

    // The strip never asserts a freshness state it does not hold.
    expect(screen.queryByTestId('analysis-freshness-notice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()

    // Existing footer affordance preserved — it is the tab's only recovery.
    const action = screen.getByTestId('results-analysis-footer-action')
    expect(action).toBeInTheDocument()
    expect(action).toHaveTextContent('Rerun')
  })

  // ── Orphan state (F11 fold: the orphan BANNER is deleted; orphan renders
  // as the freshness strip's no-verdict variant, sticky, with THE one Rerun) ─
  // One underlying state must never render two banners — Paul's 16-Jul
  // session had "Results may be outdated" stacked on "Refresh analysis" for
  // a single stale verdict. MUTATION-CHECK: restore the AnalysisOrphanBanner
  // mount in ResultsBody and these tests go RED on the second banner.
  it.each([
    ['analysisHeroPanel', 'panel'],
    ['V17', 'v17'],
    ['both hero flags off (legacy path)', 'legacy'],
  ] as const)(
    'orphan state + %s: ONE banner (the strip), footer KEEPS its robustness status',
    (_label, mode) => {
      // V5 canonical flag on with a report but NO v5 fact → orphaned result.
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsAnalysisHeroPanelEnabled.mockReturnValue(mode === 'panel')
      mockIsAnalysisHeroV17Enabled.mockReturnValue(mode === 'v17')
      seedPostRun({
        analysisFreshness: { freshness: 'stale', computedAt: 1 },
        v5AnalysisFact: null,
      })
      render(<OutputsDock />)

      // Exactly ONE trust surface: the strip (verdict wins over orphan copy).
      expect(screen.queryByTestId('analysis-orphan-banner')).not.toBeInTheDocument()
      expect(screen.getByTestId('analysis-freshness-notice')).toBeInTheDocument()

      // The footer still states the robustness verdict (C1 finding 2).
      expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
      expect(screen.getByTestId('results-analysis-footer')).toHaveTextContent('Robustness unknown')

      // A verdict is held, so the strip owns the one Rerun and the footer is
      // status-only — the dedupe C1 actually needs, done by the right gate.
      expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
      expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
    },
  )

  it('orphan state with NO verdict: the strip renders the cannot-confirm variant with the ONE Rerun (F11 fold upgrade)', () => {
    // Pre-fold, this state rendered the orphan banner INSIDE the scroller
    // (its CTA scrolled away) while the strip rendered nothing. Post-fold the
    // strip itself carries the orphan state — and the strip is sticky
    // (structural proxy asserted below; jsdom cannot prove pinning visually —
    // the real-browser acceptance run remains the pre-merge gate for the
    // visibility claim).
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
    seedPostRun({ analysisFreshness: null, v5AnalysisFact: null })
    render(<OutputsDock />)

    expect(screen.queryByTestId('analysis-orphan-banner')).not.toBeInTheDocument()
    const strip = screen.getByTestId('analysis-freshness-notice')
    expect(strip).toHaveAttribute('data-orphaned', 'true')
    expect(strip).toHaveAttribute('data-freshness', 'unknown')
    const stripRerun = screen.getByTestId('freshness-strip-rerun')
    expect(stripRerun).toBeInTheDocument()

    // With the strip holding a state, the footer is status-only (C1: one owner).
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()

    // Whole-tree sweep: exactly ONE rerun control under any spelling — this
    // is the one genuinely NEW ownership state the fold created, so it gets
    // the same sweep + cannot-scroll-away rigour as the verdict states.
    expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([stripRerun])
    expectRerunOwnerCannotScrollAway(stripRerun, { insideScroller: true })
  })

  it("orphan state with a 'none' verdict: the strip PREFERS the cannot-confirm variant and keeps the ONE Rerun (no zero-affordance hole)", () => {
    // The C1 blocker cell: canonical flag ON, results present, no V5 fact
    // (orphaned — reachable because a 'none' turn also CLEARS the fact),
    // and a held {freshness:'none'} verdict. Pre-fix the strip rendered
    // "No analysis yet." (no Rerun — offersRerun is freshness !== 'none')
    // above a full results body while `freshnessStripOwnsRerun`'s orphan
    // term stripped the footer action too: ZERO recovery controls in the
    // tab, and incoherent copy. The precedence rule
    // (resolveTrustEffectiveState) now prefers the orphan cannot-confirm
    // variant over a 'none' verdict when results exist, so the strip owns
    // the one Rerun and the copy is honest.
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
    seedPostRun({
      analysisFreshness: { freshness: 'none', computedAt: 1 },
      v5AnalysisFact: null,
    })
    render(<OutputsDock />)

    const strip = screen.getByTestId('analysis-freshness-notice')
    expect(strip).toHaveAttribute('data-orphaned', 'true')
    expect(strip).toHaveAttribute('data-freshness', 'unknown')
    expect(strip).toHaveTextContent('Cannot confirm whether this analysis is current.')
    expect(strip).not.toHaveTextContent('No analysis yet.')

    const stripRerun = screen.getByTestId('freshness-strip-rerun')
    expect(stripRerun).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()

    // ≥1 recovery affordance ALWAYS (the C1 invariant this cell violated):
    // exactly one, and it cannot scroll away.
    expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([stripRerun])
    expectRerunOwnerCannotScrollAway(stripRerun, { insideScroller: true })
  })
})
