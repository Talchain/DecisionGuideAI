import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) }, isSupabaseAvailable: () => false }))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('react-router-dom', async (io) => ({ ...(await io<any>()), useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('../../../flags', async (io) => ({ ...(await io<any>()), isAiPanelV2Enabled: () => true, isJourneyTabEnabled: () => false, isTelemetryEnabled: () => false }))
vi.mock('../../hooks/useGraphReadiness', async (io) => ({ ...(await io<any>()), useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="stub-pre-run" /> }))
vi.mock('../pre-analysis-v3', () => ({ default: () => <div data-testid="stub-pre-run-v3" /> }))
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
function snap(tag: string) {
  const cs: any = useCanvasStore.getState()
  console.log(tag, JSON.stringify({
    nodes: cs.nodes.length, resultsStatus: cs.resultsStatus ?? cs.results?.status, showResultsPanel: cs.showResultsPanel,
    hasCompletedFirstRun: cs.hasCompletedFirstRun,
    uiTab: useUIStore.getState().activeOutputTab, uiVer: useUIStore.getState().activeOutputTabVersion,
    ss: sessionStorage.getItem('canvas.outputsDock.v1'),
    collapse: screen.queryByTestId('dock-collapse-control')?.getAttribute('aria-label'),
  }))
}
describe('probe2', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear()
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0, outputSurfaceOrigin: null, outputSurfaceOriginSeq: 0, outputSurfaceOriginAt: null })
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
  })
  it('t1 opens via rail', () => {
    render(<ConversationProvider><OutputsDock /></ConversationProvider>)
    snap('T1-PRE ')
    const nav = document.querySelector('nav[aria-label="Outputs sections"]')
    const btn = Array.from(nav!.querySelectorAll('button[aria-label]')).find(b => b.getAttribute('aria-label') === 'Analysis') as HTMLElement
    fireEvent.click(btn); snap('T1-POST')
    expect(true).toBe(true)
  })
  it('t2 should still start collapsed', () => {
    render(<ConversationProvider><OutputsDock /></ConversationProvider>)
    snap('T2-PRE ')
    expect(true).toBe(true)
  })
})
