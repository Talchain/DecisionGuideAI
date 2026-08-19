/**
 * MOUNT IDENTITY, LINK 3 — the floating host names its thread as the FLOATING
 * surface, not the canonical one.
 *
 * Links 1 and 2 (ChatThread honours the identity; ConversationPanel forwards
 * it) are pinned in `src/canvas/conversation/__tests__/threadMountIdentity.spec.tsx`.
 * This file closes the chain at the host, because a chain with an untested link
 * is exactly where the drift goes: the prop could be threaded perfectly and the
 * floating panel simply never pass it, and every other test would stay green.
 *
 * ConversationPanel is stubbed by a PROP-CAPTURING spy rather than rendered:
 * the claim is about which identity the host hands down, and a deep render
 * would drag in tens of transitive deps to observe one string. Mock layout
 * mirrors `FloatingOlumiPanel.dockInset.spec.tsx`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

const canvasMockState = {
  nodes: [{ id: 'n1' }],
  edges: [] as Array<unknown>,
  results: { status: 'idle' as const },
  _internal: {} as Record<string, unknown>,
  selection: null as null | { id: string; label: string; kind: string },
  ceeAnalysisReady: null as unknown,
  graphHealth: null as unknown,
  runMeta: {} as unknown,
}
vi.mock('../../store', () => {
  const useCanvasStore: unknown = (selector: (s: unknown) => unknown) => selector(canvasMockState)
  const s = useCanvasStore as { getState: unknown; setState: unknown; subscribe: unknown }
  s.getState = () => canvasMockState
  s.setState = (patch: Record<string, unknown>) => Object.assign(canvasMockState, patch)
  s.subscribe = () => () => {}
  return {
    useCanvasStore,
    selectResultsStatus: (x: { results?: { status?: unknown } }) => x.results?.status,
    selectReport: (x: { results?: { report?: unknown } }) => x.results?.report,
    selectError: (x: { results?: { error?: unknown } }) => x.results?.error,
    selectResultsSource: (x: { results?: { source?: unknown } }) => x.results?.source,
  }
})

/** THE CAPTURE: every identity the host hands to a ConversationPanel. */
const handedDownTestIds: Array<string | undefined> = []
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: (props: { threadTestId?: string }) => {
    handedDownTestIds.push(props.threadTestId)
    return null
  },
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask',
}))
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      return {
        messages: [],
        isThinking: false,
        longRunningHint: null,
        sendMessage,
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
      }
    },
    isNonConversationalContent: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { THREAD_TESTID_DOCKED, THREAD_TESTID_FLOATING } from '../../conversation/zones/ChatThread'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
  useFloatingPanelState.getState().reset()
  handedDownTestIds.length = 0
})

describe('FloatingOlumiPanel — the identity it gives its thread', () => {
  /**
   * ⭐ COLLECTION GUARD — this file's OWN cases, by name. This file already
   * mocks `lib/supabase`, so it collects without the env vars; the guard is
   * here because a suite total can never tell you whether THIS file
   * contributed anything (CLAUDE.md trap 2b), and a one-case file is the
   * easiest of all to lose silently.
   */
  it('COLLECTION GUARD — both cases in this file were collected, by name', (ctx) => {
    const names = (ctx.task.suite?.tasks ?? []).map((t) => t.name)
    expect(names).toEqual([
      'COLLECTION GUARD — both cases in this file were collected, by name',
      'LINK 3 — hands its ConversationPanel the FLOATING identity, never the canonical one',
    ])
  })

  it('LINK 3 — hands its ConversationPanel the FLOATING identity, never the canonical one', () => {
    useFloatingPanelState.getState().open('user')
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })

    // Pin the precondition in-test: if the panel did not render a
    // ConversationPanel at all, the assertions below would pass vacuously
    // (CLAUDE.md trap 13b — a discriminator must pin its own precondition).
    expect(
      handedDownTestIds.length,
      'the floating panel rendered no ConversationPanel — this case proves nothing about identity',
    ).toBeGreaterThan(0)

    expect(
      handedDownTestIds,
      'the floating host left its thread answering to the canonical testid — both surfaces ' +
        'respond to one selector again, and a probe cannot tell which one it measured',
    ).not.toContain(THREAD_TESTID_DOCKED)
    expect(handedDownTestIds).toContain(THREAD_TESTID_FLOATING)
    expect(
      handedDownTestIds,
      'the floating host passed NO identity, so ChatThread falls back to the canonical one',
    ).not.toContain(undefined)
  })
})
