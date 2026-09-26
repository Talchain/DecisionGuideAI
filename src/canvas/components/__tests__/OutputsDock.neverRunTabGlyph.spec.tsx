/**
 * A5, THROUGH THE REAL MOUNT (#2043 review 5841802705 blocker 2).
 *
 * `WorkspaceShellTabStrip.neverRunGlyph.spec.tsx` proves the strip hides both
 * Analysis-tab freshness glyphs when it is TOLD no run has completed. It says
 * nothing about whether anything tells it: the prop defaults to `true`, and at
 * `6dc214fa` its only production mount (`OutputsDock`) did not pass it, so a
 * never-run model still showed "Cannot confirm whether this analysis is
 * current." on the deployed dock. This file drives `OutputsDock` itself and
 * sets ONLY the store — never the prop.
 *
 * Mount posture copied from `OutputsDock.tabSemantics.spec.tsx`: `aiPanelV2`
 * mocked ON (the deployed posture, and the tab glyph's own gate), the heavy
 * pre-run panels stubbed as markers (nothing here asserts their contents).
 *
 * Each never-run case has a positive control on the SAME freshness state with
 * a completed run, so the absence is about `hasCompletedFirstRun` and not a
 * glyph this fixture cannot reach.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isAiPanelV2Enabled: () => true,
    isJourneyTabEnabled: () => false,
    isTelemetryEnabled: () => false,
  }
})

vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="stub-pre-run" />,
}))
vi.mock('../pre-analysis-v3', () => ({
  default: () => <div data-testid="stub-pre-run-v3" />,
}))

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { ConversationProvider } from '../../conversation/ConversationContext'

/** The glyphs, bound by the testids and accessible names the strip authors. */
const CANNOT_CONFIRM = { testId: 'results-tab-cannot-confirm-icon', label: 'Cannot confirm whether this analysis is current.' }
const STALE = { testId: 'results-tab-stale-icon', label: 'Analysis is stale' }

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
 * The freshness state under test. `fresh` + dirty is the cannot-confirm overlay
 * (`resolveDisplayedFreshness` → 'unknown'); `stale` is CEE's stale verdict.
 * No wire verdict, so the selector's derived branch decides.
 */
function seed({ freshness, hasCompletedFirstRun }: { freshness: 'fresh-dirty' | 'stale'; hasCompletedFirstRun: boolean }) {
  useCanvasStore.setState({
    nodes: [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
    ] as never,
    edges: [] as never,
    analysisStateV1: null,
    analysisFreshness: { freshness: freshness === 'stale' ? 'stale' : 'fresh' },
    analysisFreshnessDirty: freshness === 'fresh-dirty',
    hasCompletedFirstRun,
  } as never)
}

async function renderExpandedDock() {
  render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
  const control = await screen.findByTestId('dock-collapse-control')
  if (control.getAttribute('aria-label') === 'Expand outputs dock') fireEvent.click(control)
  await waitFor(() => {
    expect(screen.getByTestId('outputs-dock-tab-results')).toBeInTheDocument()
  })
}

function expectGlyphAbsent(glyph: { testId: string; label: string }) {
  expect(screen.queryByTestId(glyph.testId)).toBeNull()
  expect(screen.queryByLabelText(glyph.label)).toBeNull()
}

describe('OutputsDock → Analysis-tab freshness glyph: a never-run model has no analysis to be current (A5)', () => {
  beforeEach(() => {
    cleanup()
    ensureMatchMedia()
    sessionStorage.clear()
    localStorage.clear()
    useUIStore.setState({
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
      outputSurfaceOrigin: null,
      outputSurfaceOriginSeq: 0,
      outputSurfaceOriginAt: null,
    })
    useFloatingPanelState.getState().close()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('POSITIVE CONTROL: after a completed run, the cannot-confirm overlay shows its glyph on the mounted strip', async () => {
    seed({ freshness: 'fresh-dirty', hasCompletedFirstRun: true })
    await renderExpandedDock()
    expect(screen.getByTestId(CANNOT_CONFIRM.testId)).toHaveAttribute('aria-label', CANNOT_CONFIRM.label)
  })

  it('RED/A5 through the mount: the same state with NO completed run shows no cannot-confirm glyph', async () => {
    seed({ freshness: 'fresh-dirty', hasCompletedFirstRun: false })
    await renderExpandedDock()
    expectGlyphAbsent(CANNOT_CONFIRM)
    expectGlyphAbsent(STALE)
  })

  it('POSITIVE CONTROL: after a completed run, a stale verdict shows the stale glyph on the mounted strip', async () => {
    seed({ freshness: 'stale', hasCompletedFirstRun: true })
    await renderExpandedDock()
    expect(screen.getByTestId(STALE.testId)).toHaveAttribute('aria-label', STALE.label)
  })

  it('RED/A5 through the mount: a stale verdict with NO completed run shows no stale glyph', async () => {
    seed({ freshness: 'stale', hasCompletedFirstRun: false })
    await renderExpandedDock()
    expectGlyphAbsent(STALE)
    expectGlyphAbsent(CANNOT_CONFIRM)
  })
})
