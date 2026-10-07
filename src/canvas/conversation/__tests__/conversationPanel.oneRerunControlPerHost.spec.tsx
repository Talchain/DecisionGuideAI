/**
 * ONE RERUN CONTROL PER CHAT HOST (S-F; Paul, 7 Oct 2026: "get rid of the pill inside the chat and just have the
 * re-analyse button"; buddy r1 P1: the floating panel kept the pill, and with no run chip it had ZERO controls).
 *
 * The real `ConversationPanel`, the real stores; the host is the only variable. After a Run, with the model changed:
 *   · floating alone            → the panel draws the SAME `ReanalyseBar` under the thread; no pill;
 *   · floating beside a dock surface that owns rerun → no bar here, no pill (that surface's control is on screen);
 *   · docked                    → no bar here (the shell footer draws it), no pill;
 *   · headless (no host)        → unchanged: the chip, relabelled "Rerun".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import type { ConversationMessage } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'
import type { RerunHost } from '../../components/workspaceShell/rerunControl'

const APPROVED_REPLY: ConversationMessage = {
  id: 'a-approve',
  role: 'assistant',
  content: 'Added the option. Saved as version 2.',
  timestamp: new Date('2026-10-07T09:15:56Z'),
  actionChips: [{ id: 'agent-run-analysis', label: 'Run analysis', intent: 'primary', message: 'Run analysis', action_type: 'run_analysis' }],
} as ConversationMessage

function conversation(): UseConversationReturn {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()
  return {
    messages: [APPROVED_REPLY],
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: vi.fn() as unknown as UseConversationReturn['dispatchAction'],
    cancelTurn: vi.fn(),
    startNewDraft: vi.fn(async () => {}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined) as unknown as UseConversationReturn['sendSystemEvent'],
    sendChip: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: patchStates,
    setPatchBlockState: (key: string, state: PatchBlockState) => { patchStates.set(key, state) },
    settledSourceBlockKeys: new Set<string>(),
    patchRejections,
    setPatchRejection: (key: string, info: PatchRejectionInfo) => { patchRejections.set(key, info) },
  }
}

function draw(rerunHost?: RerunHost) {
  render(
    <ToastProvider>
      <ConversationPanel conversation={conversation()} onCollapse={vi.fn()} onAttach={vi.fn()} hideComposer compact rerunHost={rerunHost} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  try { localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  ;(Element.prototype as unknown as { scrollTo: unknown }).scrollTo = vi.fn()
  useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
  useCanvasStore.setState({
    nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Launch on time' } }],
    edges: [],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    hasCompletedFirstRun: true,
    results: { status: 'complete' },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  } as never)
  // The approve turn changed the model: CEE now calls the Run stale.
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
})

afterEach(() => {
  try { localStorage.removeItem('feature.aiPanelV2') } catch {}
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  delete (Element.prototype as unknown as { scrollTo?: unknown }).scrollTo
  useCanvasStore.setState({ nodes: [], edges: [], analysisFreshness: null } as never)
})

const pill = () => screen.queryByTestId('suggested-chip-agent-run-analysis')
const ownBar = () => screen.queryByTestId('conversation-rerun-bar')

describe('one rerun control per chat host, after a model change', () => {
  it('⛔ floating alone: the panel draws the Re-analyse bar and no pill', () => {
    draw('floating')
    expect(screen.getByTestId('chat-thread').textContent, 'precondition: the reply carrying the run chip is on screen').toContain('Saved as version 2')
    expect(ownBar(), 'the floating panel had no rerun control but the pill').not.toBeNull()
    expect(screen.getByTestId('reanalyse-button')).toHaveTextContent('Re-analyse')
    expect(pill(), 'the forbidden in-chat pill').toBeNull()
  })

  it('floating beside a dock surface that owns rerun: no bar here and no pill (the surface\'s control is on screen)', () => {
    draw('floating-beside-dock')
    expect(ownBar()).toBeNull()
    expect(pill()).toBeNull()
  })

  it('docked: no bar here (the shell footer draws it) and no pill', () => {
    draw('docked')
    expect(ownBar()).toBeNull()
    expect(pill()).toBeNull()
  })

  it('CONTRAST: a headless mount (no host) is unchanged — the chip, relabelled "Rerun"', () => {
    draw(undefined)
    expect(ownBar()).toBeNull()
    expect(pill()).toHaveTextContent(/^\s*Rerun\s*$/)
  })
})
