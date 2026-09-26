/**
 * ⭐ ONE PRE-RUN RUN CONTROL ON THE DEFAULT SCREEN, AND NEVER TWO ON ANY TAB
 * (design audit 26 Sep 2026 §2 item 6, register row #31).
 *
 * SERVED at `853feeb7` (1280×800, pricing starter, fresh guest):
 *   - the dock opened on Reasoning (`outputs-dock-tab-analysisNew` selected);
 *   - that screen carried TWO Run buttons before any run: the Reasoning body's
 *     "Run the analysis" (100.8×24 at y 238) and the shell footer's "Analyse"
 *     (89.2×31.5 at y 689) — `ReanalyseBar` in its never-run state.
 * Re-measured on served `e63c89a0` per tab, pre-run: Olumi 1 ("Analyse first
 * pass", the readiness bar), Reasoning 2, Model 1 (the footer "Analyse").
 *
 * TARGET: the panel opens on Olumi (the 25 Sep design prototype), whose first
 * screen has exactly one Run control; and the Reasoning tab keeps ONE — its
 * body's gate-aware "Run the analysis" — with the shell's Rerun bar joining it
 * only once a run has completed. The Model tab keeps its bar: it is that
 * surface's only run control.
 *
 * WHAT THIS FILE PINS, AND HOW. It pins the SHELL's decisions: which tab is
 * fronted, and which footer arm the shell mounts under each surface. Both
 * footer bars are replaced by identity stubs so the assertion is about the
 * shell's arm and not about either bar's own internal null-states (each bar
 * has its own suite). Bound by the tabs' `data-testid` + `aria-selected` and
 * the stubs' test ids.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
import { WORKSPACE_SURFACES } from '../workspaceShell/shellContract'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isTelemetryEnabled: () => true, isJourneyTabEnabled: vi.fn(() => false) }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))
vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: () => <div data-testid="mock-results-body" />,
}))
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({
  AnalysisNewTabBody: () => <div data-testid="mock-analysis-new-body" />,
}))
// Identity stubs for the two shell-hosted bars — see the header.
vi.mock('../model-tab/ReanalyseBar', () => ({
  ReanalyseBar: () => <div data-testid="stub-reanalyse-bar" />,
}))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({
  AnalysisReadinessBar: () => <div data-testid="stub-readiness-bar" />,
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

function seedGraph(hasCompletedFirstRun: boolean) {
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun,
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

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

const frontedTab = () =>
  document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null

const footer = () => screen.queryByTestId('shell-surface-footer-bar')
const footerHas = (tid: string) => {
  const f = footer()
  return f ? within(f).queryByTestId(tid) !== null : false
}

const front = (id: string) => act(() => { screen.getByTestId(`outputs-dock-tab-${id}`).click() })

describe('one pre-run Run control on the default screen, never two on a tab', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    sessionStorage.clear()
    try { window.history.replaceState({}, '', '/canvas') } catch { /* jsdom */ }
    useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  })
  afterEach(() => {
    sessionStorage.clear()
    try { window.history.replaceState({}, '', '/canvas') } catch { /* jsdom */ }
    useCanvasStore.setState({ hasCompletedFirstRun: false } as never)
  })

  it('a fresh, pre-run session opens on Olumi, whose footer is the readiness bar and not the Rerun bar', () => {
    seedGraph(false)
    renderDock()
    expect(frontedTab()).toBe('outputs-dock-tab-olumi')
    expect(footerHas('stub-readiness-bar')).toBe(true)
    expect(footerHas('stub-reanalyse-bar')).toBe(false)
  })

  it('pre-run, the Reasoning tab gets NO shell Rerun bar — its body carries the one Run control', () => {
    seedGraph(false)
    renderDock()
    front('analysisNew')
    expect(frontedTab()).toBe('outputs-dock-tab-analysisNew')
    expect(screen.getByTestId('mock-analysis-new-body')).toBeInTheDocument()
    expect(footerHas('stub-reanalyse-bar')).toBe(false)
    expect(footerHas('stub-readiness-bar')).toBe(false)
  })

  it('CONTRAST: pre-run, the Model tab KEEPS its Rerun bar — it is that surface\'s only run control', () => {
    seedGraph(false)
    renderDock()
    front('diagnostics')
    expect(frontedTab()).toBe('outputs-dock-tab-diagnostics')
    expect(footerHas('stub-reanalyse-bar')).toBe(true)
  })

  it('CONTRAST: after the first run, the Reasoning tab gets the same Rerun bar back', () => {
    seedGraph(true)
    renderDock()
    front('analysisNew')
    expect(frontedTab()).toBe('outputs-dock-tab-analysisNew')
    expect(footerHas('stub-reanalyse-bar')).toBe(true)
  })

  it('the declarations say so: Reasoning asks for the after-first-run bar, Model for the always bar', () => {
    expect(WORKSPACE_SURFACES.analysisNew.footerBar).toBe('reanalyseAfterFirstRun')
    expect(WORKSPACE_SURFACES.diagnostics.footerBar).toBe('reanalyse')
    expect(WORKSPACE_SURFACES.olumi.footerBar).toBe('readiness')
  })
})
