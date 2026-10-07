/**
 * ONE RERUN CONTROL ON THE OLUMI SURFACE, DERIVED FROM MODEL-CHANGED STATE (S-F; Paul, 7 Oct 2026: "get rid of the
 * pill inside the chat and just have the re-analyse button").
 *
 * After an approved change the Olumi tab showed THREE ways to do one thing: the footer's "Model changed. Results may
 * be out of date. [Re-analyse]", the composer's "Re-run analysis" icon, and CEE's "Run analysis" chip relabelled
 * "Rerun" under the reply. The rule, owned by `workspaceShell/rerunControl.ts`:
 *   · model changed (the footer bar shows) → the footer's Re-analyse is the ONLY rerun control;
 *   · a Run exists and the model has not changed → the composer icon is the only one;
 *   · on the docked Olumi tab the chat's run chip is never a rerun control after the first Run.
 * Counted by identity on the deployed dock (same harness as `OutputsDock.olumiTabRerunAfterRun.spec.tsx`).
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

/** The approve turn's reply: CEE offers "Run analysis" (suggested_actions, action_type run_analysis). */
const APPROVED_REPLY: ConversationMessage = {
  id: 'a-approve',
  role: 'assistant',
  content: "Added the option. Saved as version 2. Run it again to see the comparison.",
  timestamp: new Date('2026-10-07T09:15:56Z'),
  actionChips: [{ id: 'agent-run-analysis', label: 'Run analysis', intent: 'primary', message: 'Run analysis', action_type: 'run_analysis' }],
} as ConversationMessage
const conversationBase = {
  messages: [APPROVED_REPLY] as ConversationMessage[],
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


/** A completed Run, as production holds it (`results.status` complete), with CEE's verdict on it. */
function afterRun(freshness: 'stale' | 'fresh') {
  seedModelAfterRun(freshness)
  useCanvasStore.setState({ results: { status: 'complete', progress: 100 } } as never)
}

/** Every rerun control on the Olumi surface, by identity. */
function rerunControls() {
  return {
    bar: screen.queryByTestId('reanalyse-button'),
    composer: screen.queryByTestId('ai-input-bar-strip-analyse'),
    chip: screen.queryByTestId('suggested-chip-agent-run-analysis'),
  }
}

describe('one rerun control on the Olumi surface', () => {
  it('⛔ model changed: the footer Re-analyse is the ONLY rerun control (no chat pill, no composer icon)', async () => {
    afterRun('stale')
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    // Precondition: the reply carrying CEE's run chip is on screen (otherwise "no chip" proves nothing).
    expect(screen.getByTestId('chat-thread').textContent).toContain('Saved as version 2')
    const c = rerunControls()
    expect(c.bar, 'the footer must offer Re-analyse').not.toBeNull()
    expect(c.bar).toHaveTextContent('Re-analyse')
    expect(c.chip, 'a second rerun control: the in-chat pill').toBeNull()
    expect(c.composer, 'a second rerun control: the composer icon').toBeNull()
  }, 30_000)

  it('a current Run: the composer icon is the only rerun control (no bar, no chat pill)', async () => {
    afterRun('fresh')
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    const c = rerunControls()
    expect(c.bar).toBeNull()
    expect(c.chip).toBeNull()
    expect(c.composer, 'with no bar the composer icon is the way to rerun').not.toBeNull()
  }, 30_000)

  it('the bar leaving (a fresh Run lands) hands the rerun back to the composer icon on the same mounted dock', async () => {
    afterRun('stale')
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    expect(rerunControls().composer).toBeNull()
    act(() => { useCanvasStore.setState({ analysisFreshness: { freshness: 'fresh' } } as never) })
    const c = rerunControls()
    expect(c.bar).toBeNull()
    expect(c.composer).not.toBeNull()
    expect(c.chip).toBeNull()
  }, 30_000)

  it('CONTRAST: before the first Run, CEE\'s "Run analysis" chip is a RUN (not a rerun) control and is left as it was', async () => {
    seedModelAfterRun('stale', false)
    render(<Wrapper><OutputsDock /></Wrapper>)
    await screen.findByTestId('outputs-dock-tab-olumi', {}, { timeout: 20_000 })
    frontOlumi()
    const c = rerunControls()
    expect(c.bar).toBeNull()
    expect(c.composer).toBeNull()
    expect(c.chip, 'pre-run behaviour must not change in this slice').not.toBeNull()
  }, 30_000)
})
