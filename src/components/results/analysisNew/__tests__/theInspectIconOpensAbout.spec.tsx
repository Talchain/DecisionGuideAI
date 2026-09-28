/**
 * Paul, 28 Sep 2026: "Have you added the icon?" — the V2 prototype's tab-bar ⓘ,
 * "Inspect this analysis" (`data-action="about"`): front Reasoning, open "About
 * this analysis", move there. The strip asks through `requestReasoningAbout`;
 * About opens, takes focus and clears the request.
 *
 * Bound by identity: the strip's `dock-inspect-analysis` testid and its label
 * constant, About's `-toggle` testid and `aria-expanded`, the store flag itself.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => null,
  useConversationContext: () => null,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => vi.fn(),
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '@/canvas/store'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AboutThisAnalysis } from '../sections/AboutThisAnalysis'
import { genuineDecision } from './analysisNewFixtures'
import {
  INSPECT_ANALYSIS_LABEL,
  WorkspaceShellTabStrip,
} from '../../../../canvas/components/workspaceShell/WorkspaceShellTabStrip'
import { PanelWidthProvider } from '../../../../canvas/components/workspaceShell/usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../../../../canvas/components/workspaceShell/shellContract'

const TID = 'analysis-new-about'
const NO_UNIT = { unit: undefined, symbol: undefined, isNormalised: undefined }
const vm = (isPreRun = false) =>
  buildAnalysisNewViewModel({
    data: genuineDecision(),
    recommendations: [],
    isPreRun,
    isRunning: false,
    isStale: false,
    responseHash: 'run_inspect_1',
  })

const REASONING: WorkspaceSurfaceDescriptor = { id: 'analysisNew', label: 'Reasoning', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' }
const MODEL: WorkspaceSurfaceDescriptor = { id: 'diagnostics', label: 'Model', scroll: 'shell', padding: 'shell', presentedAsTab: true, hiddenReason: '', footerBar: 'reanalyse' }

const strip = (over: { width?: number; surfaces?: WorkspaceSurfaceDescriptor[]; ran?: boolean; onInspect?: (() => void) | null } = {}) => {
  const onInspect = over.onInspect === undefined ? vi.fn() : over.onInspect
  render(
    <PanelWidthProvider value={{ width: over.width ?? 480, contentWidth: (over.width ?? 480) - 26 }}>
      <WorkspaceShellTabStrip
        surfaces={over.surfaces ?? [REASONING, MODEL]}
        activeTab="diagnostics"
        onTabClick={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
        expertMode={false}
        onToggleExpertMode={vi.fn()}
        showResultsFreshnessIcon={false}
        resultsStale={false}
        factorsToVerify={0}
        hasCompletedFirstRun={over.ran ?? true}
        onInspectAnalysis={onInspect ?? undefined}
      />
    </PanelWidthProvider>,
  )
  return onInspect
}

beforeEach(() => {
  useUIStore.setState({ pendingReasoningAbout: false })
  useCanvasStore.setState({ currentScenarioId: 'scn_inspect', nodes: [] } as never)
})
afterEach(() => {
  cleanup()
  useUIStore.setState({ pendingReasoningAbout: false })
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
})

describe('the strip carries the ⓘ "Inspect this analysis"', () => {
  it('after a run, with Reasoning in the strip: one named icon control that calls the handler', () => {
    const onInspect = strip()
    const btn = screen.getByTestId('dock-inspect-analysis')
    expect(btn).toHaveAttribute('aria-label', INSPECT_ANALYSIS_LABEL)
    expect(INSPECT_ANALYSIS_LABEL).toBe('Inspect this analysis')
    fireEvent.click(btn)
    expect(onInspect).toHaveBeenCalledTimes(1)
  })

  it('CONTRAST: never run → no ⓘ (About states nothing pre-run, so it would open nothing)', () => {
    strip({ ran: false })
    expect(screen.queryByTestId('dock-inspect-analysis')).toBeNull()
  })

  it('CONTRAST: no Reasoning surface in the strip → no ⓘ', () => {
    strip({ surfaces: [MODEL] })
    expect(screen.queryByTestId('dock-inspect-analysis')).toBeNull()
  })

  it('CONTRAST: no handler wired → no ⓘ (never a control that does nothing)', () => {
    strip({ onInspect: null })
    expect(screen.queryByTestId('dock-inspect-analysis')).toBeNull()
  })

  it('compact (280px): the ⓘ folds into the overflow menu, labelled, and still calls the handler', () => {
    const onInspect = strip({ width: 280 })
    expect(screen.queryByTestId('dock-inspect-analysis')).toBeNull()
    fireEvent.click(screen.getByTestId('dock-overflow-trigger'))
    const item = screen.getByTestId('dock-inspect-analysis')
    expect(item).toHaveTextContent(INSPECT_ANALYSIS_LABEL)
    fireEvent.click(item)
    expect(onInspect).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('dock-overflow-menu')).toBeNull()
  })
})

describe('About answers the request', () => {
  it('⭐ a request opens About, focuses its toggle and clears itself — contrast: without one it stays closed', () => {
    render(<AboutThisAnalysis vm={vm()} outcomeFormat={NO_UNIT} />)
    const toggle = screen.getByTestId(`${TID}-toggle`)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    act(() => useUIStore.getState().requestReasoningAbout(true))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${TID}-region`)).toBeInTheDocument()
    expect(document.activeElement).toBe(toggle)
    expect(useUIStore.getState().pendingReasoningAbout).toBe(false)
  })

  it('a request made BEFORE About mounts (the tab switch) is answered on mount', () => {
    useUIStore.getState().requestReasoningAbout(true)
    render(<AboutThisAnalysis vm={vm()} outcomeFormat={NO_UNIT} />)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    expect(useUIStore.getState().pendingReasoningAbout).toBe(false)
  })

  it('pre-run with nothing to show: the request is cleared and nothing renders, so it cannot fire later', () => {
    useUIStore.getState().requestReasoningAbout(true)
    render(<AboutThisAnalysis vm={vm(true)} outcomeFormat={NO_UNIT} />)
    expect(screen.queryByTestId(TID)).toBeNull()
    expect(useUIStore.getState().pendingReasoningAbout).toBe(false)
  })
})
