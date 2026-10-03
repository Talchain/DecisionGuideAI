/**
 * ACCOUNTS viewer mode on the DEPLOYED posture (AI panel v2): PANEL 5947736451's row.
 * A colleague viewing a shared decision keeps the Olumi surface, but has no composer
 * (one notice instead) and no readiness / re-analyse footer, so they have no Run.
 * CONTRAST: the owner on the same seed has both.
 * The flag comes through the real `useScenarioViewerAccess`, with `scenario_access` faked.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ConversationMessage } from '../../conversation/types'

const access = vi.hoisted(() => ({ getScenarioAccess: vi.fn() }))
vi.mock('../../../services/scenarioSharingService', () => access)
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
import { isAiPanelV2Enabled } from '../../../flags'
import { isViewerSession, VIEWER_COMPOSER_NOTICE, __resetViewerModeForTests } from '../../../lib/viewerMode'
import { useScenarioViewerAccess } from '../../../lib/useScenarioViewerAccess'

const SID = '3b241101-e2bb-4255-8caf-4136c566a962'
function ViewerFlag() {
  useScenarioViewerAccess(SID, true, 'u1')
  return null
}

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


describe('viewer mode on the Olumi surface (deployed posture)', () => {
  beforeEach(() => {
    __resetViewerModeForTests()
    access.getScenarioAccess.mockReset()
  })

  it('MOUNT PATH: AI panel v2 is the deployed posture this row binds to', () => {
    expect(isAiPanelV2Enabled()).toBe(true)
  })

  it('VIEWER: no composer (the notice instead), no footer bar, no Re-analyse; the Olumi surface still shows', async () => {
    access.getScenarioAccess.mockResolvedValue('viewer')
    seedModelAfterRun('stale')
    render(<Wrapper><ViewerFlag /><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    await act(async () => {})
    expect(isViewerSession()).toBe(true)
    frontOlumi()
    expect(screen.queryByTestId('shell-surface-footer-bar')).toBeNull()
    expect(screen.queryByTestId('reanalyse-button')).toBeNull()
    expect(document.querySelector('[data-testid$="-textarea"]')).toBeNull()
    const notices = screen.getAllByTestId('viewer-composer-notice')
    expect(notices.length).toBeGreaterThan(0)
    expect(notices[0]).toHaveTextContent(VIEWER_COMPOSER_NOTICE)
  }, 30_000)

  it('CONTRAST, OWNER on the same seed: the composer, the footer bar and Re-analyse are all there; no notice', async () => {
    access.getScenarioAccess.mockResolvedValue('owner')
    seedModelAfterRun('stale')
    render(<Wrapper><ViewerFlag /><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    await act(async () => {})
    expect(isViewerSession()).toBe(false)
    frontOlumi()
    expect(within(screen.getByTestId('shell-surface-footer-bar')).getByTestId('reanalyse-button')).toBeTruthy()
    expect(document.querySelector('[data-testid$="-textarea"]')).not.toBeNull()
    expect(screen.queryByTestId('viewer-composer-notice')).toBeNull()
  }, 30_000)
})
