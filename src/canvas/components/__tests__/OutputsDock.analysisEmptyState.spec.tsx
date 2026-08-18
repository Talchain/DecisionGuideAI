/**
 * THE TWO DEAD STATES OF THE `Analysis` DOCK TAB — pinned.
 *
 * Both were driven as a fresh guest on the deployed build `9ff14c19`
 * (18 Aug 2026) and settled against the LIVE DOM, not a screenshot.
 *
 * ── A2 · THE COLLAPSED RAIL'S TAB ICONS WERE DEAD CONTROLS ────────────────
 * Measured: with the dock at its first-use rail, clicking the rail's
 * `Analysis` icon left `dock-collapse-control` reading `Expand outputs dock`,
 * `outputs-dock-tab-results` ABSENT and `outputs-dock-body` ABSENT. Zero
 * observable change. The click had selected a tab inside a panel the user could
 * not see, discoverable only by separately pressing `Expand outputs dock`.
 *
 * Mechanism: `effectiveIsOpen` is `isFirstUse ? false : state.isOpen`, so
 * `handleTabClick`'s `isOpen: true` was OVERRIDDEN by the rail.
 * `toggleOpen`, the run-start auto-switch and the collapsed-response signal all
 * drop the rail lock with `userExplicitlyOpenedRailRef.current = true`;
 * `handleTabClick` was the one activation path that did not.
 *
 * ⚠ TRAP 3b — THE FLAG THAT DECIDES WHETHER THIS TEST IS ABOUT ANYTHING.
 * The rail only exists when `aiPanelV2` is ON. It is `defaultValue: true` AND
 * `VITE_FEATURE_AI_PANEL_V2 = "true"` in `netlify.toml`, and the rail was
 * OBSERVED rendering on staging (three icons: Olumi / Analysis / Model), so the
 * mounted path is the one under test here. The flag is mocked ON explicitly
 * rather than left to a default, so this suite fails loudly if that ever moves
 * instead of passing vacuously against a rail that no longer renders.
 *
 * ── A3 · THE EXPANDED PANEL WAS COMPLETELY BLANK ──────────────────────────
 * Measured: Analysis tab active (`border-info` on `outputs-dock-tab-results`),
 * `outputs-dock-body` present at 414 x 540 px, and `innerText` exactly `""`.
 * Zero copy, no reason, no next step.
 *
 * Mechanism: every section of the results branch is gated on either
 * `isPreRun && nodes.length > 0` or `!isPreRun`, so the INTERSECTION — no
 * analysis has completed AND no model on the canvas — had no renderer at all.
 * The `Model` tab already does this correctly (`ModelOutline`'s "Nothing in
 * this group yet"), which is the pattern the fix copies.
 *
 * ── WHAT THE EMPTY-STATE COPY MAY CLAIM ───────────────────────────────────
 * Its reachable condition is exactly `isPreRun && nodes.length === 0`, so the
 * only facts in evidence are "no analysis has completed" and "no model on the
 * canvas". It deliberately does NOT promise that describing a decision will
 * produce a model — the same sweep found that promise broken on the
 * `Build the model` chip, and repeating it here would make this fix another
 * instance of the defect class it removes. The one thing it does promise is the
 * button's destination, and that is asserted below by driving it.
 */

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// OutputsDock's import chain pulls in supabase + dompurify, which break under
// the test env. Stub both before any module evaluation.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

// Spread the real module: a hand-listed factory silently drops every export
// added later, and this repo has shipped that failure (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isAiPanelV2Enabled: () => true,
    isJourneyTabEnabled: () => false,
    isTelemetryEnabled: () => false,
  }
})

// The real readiness hook fetches a relative URL on mount, which jsdom rejects
// with "Invalid URL" as an unhandled rejection. Nothing here asserts readiness.
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

// The pre-run readiness panel is stubbed for the same reason the sibling
// `OutputsDock.analysis-run.spec.tsx` stubs it: the real one calls
// `useShowToast()`, which THROWS outside a `<ToastProvider>`. Nothing here
// asserts anything about its contents — the twin case below only needs to know
// that the EMPTY state is absent once a model exists, so the stub is a marker,
// not a fixture standing in for behaviour under test.
vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="stub-pre-run" />,
}))
vi.mock('../pre-analysis-v3', () => ({
  default: () => <div data-testid="stub-pre-run-v3" />,
}))

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

/** The collapsed rail's icon buttons, addressed the way the DOM exposes them. */
function railIcon(label: 'Olumi' | 'Analysis' | 'Model') {
  const nav = document.querySelector('nav[aria-label="Outputs sections"]')
  const btns = Array.from(nav?.querySelectorAll('button[aria-label]') ?? [])
  return btns.find((b) => b.getAttribute('aria-label') === label) as HTMLElement | undefined
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

describe('the Analysis dock tab in its two measured-dead states (affordance sweep A2 + A3)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    // A fresh guest: empty canvas, no analysis has ever completed. This is the
    // exact intersection that had no renderer.
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('A2 — starts at the first-use rail, so the icons under test are the mounted ones', () => {
    renderDock()
    // PRECONDITION PINNED IN-TEST. Without this the two cases below could pass
    // on an already-expanded dock, where `handleTabClick` never needed the
    // override at all — a guard agreeing with itself.
    expect(screen.getByTestId('dock-collapse-control')).toHaveAttribute(
      'aria-label',
      'Expand outputs dock',
    )
    expect(screen.queryByTestId('outputs-dock-tab-results')).toBeNull()
    expect(screen.queryByTestId('outputs-dock-body')).toBeNull()
    expect(railIcon('Analysis')).toBeTruthy()
  })

  it('A2 — clicking the collapsed rail’s Analysis icon OPENS the dock on Analysis', async () => {
    renderDock()
    const icon = railIcon('Analysis')!

    fireEvent.click(icon)

    // THE assertions that were RED: the dock stayed at 40px and the body never
    // mounted, so the user saw nothing at all.
    await waitFor(() => {
      expect(screen.getByTestId('dock-collapse-control')).toHaveAttribute(
        'aria-label',
        'Collapse outputs dock',
      )
    })
    expect(screen.getByTestId('outputs-dock-tab-results')).toBeInTheDocument()
    expect(screen.getByTestId('outputs-dock-body')).toBeInTheDocument()
  })

  it('A2 — the fix is on the shared handler, not special-cased to Analysis', async () => {
    // The defect was in `handleTabClick`, which every rail icon shares, so a
    // fix that only rescued Analysis would be the wrong shape. Driving a
    // DIFFERENT icon is the discrimination: it must open the dock too.
    renderDock()
    fireEvent.click(railIcon('Model')!)

    await waitFor(() => {
      expect(screen.getByTestId('dock-collapse-control')).toHaveAttribute(
        'aria-label',
        'Collapse outputs dock',
      )
    })
    expect(screen.getByTestId('outputs-dock-tab-diagnostics')).toBeInTheDocument()
  })

  it('A3 — the expanded Analysis panel says what is going on instead of rendering nothing', async () => {
    renderDock()
    fireEvent.click(railIcon('Analysis')!)

    const empty = await screen.findByTestId('outputs-analysis-empty')
    expect(empty).toBeInTheDocument()
    // Bound to the sentences, not merely to a non-empty box: the measured
    // defect was "zero copy", and a container with no text would satisfy a
    // presence-only assertion.
    expect(empty).toHaveTextContent('Nothing to analyse yet')
    expect(empty).toHaveTextContent('This panel reports on a decision model')

    // The measured symptom, asserted directly: the dock body was `innerText`
    // exactly "". It must not be that any more.
    expect(screen.getByTestId('outputs-dock-body').textContent).not.toBe('')
  })

  it('A3 — the empty state’s only promise is its destination, and it keeps it', async () => {
    // P8: an affordance must have an acceptance path for its direct answer. The
    // button says "Describe your decision to Olumi", so pressing it must reach
    // the Olumi surface — which is the one surface measured as WORKING for this
    // (sweep A5: the chat panel opens with its composer).
    renderDock()
    fireEvent.click(railIcon('Analysis')!)

    const cta = await screen.findByTestId('outputs-analysis-empty-describe')
    fireEvent.click(cta)

    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-tab-olumi')).toBeInTheDocument()
    })
    // Bound by identity to the ACTIVE tab, not merely to the tab existing: the
    // strip lights the active tab with `border-info`.
    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-tab-olumi').className).toContain('border-info')
    })
    // …and the empty state must be gone, because the Analysis body unmounted.
    expect(screen.queryByTestId('outputs-analysis-empty')).toBeNull()
  })

  it('OPPOSITE-DIRECTION TWIN: a canvas WITH a model does not get the empty state', async () => {
    // Without this, "renders the empty state" is satisfiable by copy that
    // always renders — which would sit on top of the pre-run readiness panel
    // and tell a user with 20 nodes that there is no model.
    useCanvasStore.setState({
      nodes: [
        { id: 'n0', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'n0' } },
      ] as never,
      edges: [] as never,
    })
    renderDock()

    // A populated canvas ends first use, so the dock is already open.
    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-tab-results')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))

    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-body')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('outputs-analysis-empty')).toBeNull()
  })
})
