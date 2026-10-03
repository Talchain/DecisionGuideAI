/**
 * AFTER THE FIRST RUN, THE OLUMI TAB STILL SAYS WHEN THE MODEL CHANGED, AND STILL OFFERS THE RERUN.
 *
 * ── THE WITNESS (R3 F5 journey witness 1, #85 5938917543, step 5; again 5942069984) ──
 * After an Accept in the chat changed the model, CEE said `complete_stale`, yet the Olumi tab (where the Accept
 * happens) showed no Re-run control: the readiness bar is PRE-RUN ONLY (`AnalysisReadinessBar`'s own null), and the
 * "model changed" surfaces lived only on the Analysis footer and the Model tab. The user had to know to go elsewhere.
 *
 * ── THE FIX, PINNED ──────────────────────────────────────────────────────────
 * The Olumi surface's `readiness` footer arm mounts the SAME `ReanalyseBar` (and gate trio) the Model tab uses once a
 * Run exists. That bar renders its own null unless the model changed, so a current Run shows nothing here.
 *
 * Harness and flag posture: `OutputsDock.readinessSurvivesTabChange.spec.tsx` (the deployed aiPanelV2 dock). Every
 * element is bound by `data-testid`; the stale state is the real store slice the classifier reads (CEE freshness
 * `stale`), not a mocked hook.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ConversationMessage } from '../../conversation/types'

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
// Spread, never a hand-listed factory; `isAiPanelV2Enabled` stays at its production default (the Olumi tab exists only
// under it).
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
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { WORKSPACE_SURFACES } from '../workspaceShell/shellContract'
import { isAiPanelV2Enabled } from '../../../flags'

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConversationProvider>{children}</ConversationProvider>
    </ToastProvider>
  )
}

/** A drafted model after a Run; `freshness` is CEE's verdict on it (`stale` = the Accept changed it). */
function seedModelAfterRun(freshness: 'stale' | 'fresh', hasCompletedFirstRun = true) {
  useCanvasStore.setState({
    nodes: [
      { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'How do we fund the AI module?' } },
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Sign the enterprise prospect' } },
      { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Build it this quarter' } },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Sprint capacity' } },
    ] as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    hasCompletedFirstRun,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    analysisFreshness: { freshness },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  } as never)
}

function frontOlumi() {
  fireEvent.click(screen.getByTestId('outputs-dock-tab-olumi'))
  const wrapper = screen.getByTestId('olumi-tab-wrapper')
  expect(wrapper.classList.contains('hidden')).toBe(false)
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

beforeEach(() => {
  try {
    sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
    sessionStorage.clear()
  } catch { /* jsdom quirk */ }
  if (typeof Element.prototype.scrollIntoView !== 'function') Element.prototype.scrollIntoView = vi.fn()
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      }),
    })
  }
  window.history.replaceState({}, '', '/')
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 } as never)
  useFloatingPanelState.setState({ isOpen: false, isMinimised: false, source: 'user' } as never)
})

afterEach(() => {
  useReadinessStore.getState().reset()
  useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null } as never)
  vi.unstubAllGlobals()
})

describe('the Olumi tab after the first Run', () => {
  it('MOUNT PATH: the deployed posture, and the Olumi surface asks for the readiness footer', () => {
    expect(isAiPanelV2Enabled()).toBe(true)
    expect(WORKSPACE_SURFACES.olumi.footerBar).toBe('readiness')
  })

  it('⛔ the Accept made the Run stale → the Olumi footer says so and offers Re-analyse; a fresh Run takes it away', async () => {
    seedModelAfterRun('stale')
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    const footer = screen.getByTestId('shell-surface-footer-bar')
    const bar = within(footer).getByTestId('reanalyse-bar')
    expect(bar).toHaveAttribute('data-reason', 'model-changed')
    expect(bar).toHaveTextContent('Model changed. Results may be out of date.')
    expect(within(footer).getByTestId('reanalyse-button')).toHaveTextContent('Re-analyse')
    // ONE control, not two: the pre-run readiness bar is not also drawn.
    expect(within(footer).queryByTestId('analysis-readiness-bar')).toBeNull()

    // Re-analyse lands a current Run (CEE: fresh) → the bar takes itself away, on the same mounted dock.
    act(() => { useCanvasStore.setState({ analysisFreshness: { freshness: 'fresh' } } as never) })
    expect(within(screen.getByTestId('shell-surface-footer-bar')).queryByTestId('reanalyse-bar')).toBeNull()
  }, 30_000)

  it('a current Run → nothing in the Olumi footer (the bar never claims a change that did not happen)', async () => {
    seedModelAfterRun('fresh')
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    const footer = screen.getByTestId('shell-surface-footer-bar')
    expect(within(footer).queryByTestId('reanalyse-bar')).toBeNull()
    expect(within(footer).queryByTestId('analysis-readiness-bar')).toBeNull()
  }, 30_000)

  it('CONTRAST: before the first Run the Olumi footer is still the readiness bar, never the reanalyse bar', async () => {
    seedModelAfterRun('stale', false)
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    const footer = screen.getByTestId('shell-surface-footer-bar')
    expect(within(footer).getByTestId('analysis-readiness-bar')).toBeTruthy()
    expect(within(footer).queryByTestId('reanalyse-bar')).toBeNull()
  }, 30_000)
})
