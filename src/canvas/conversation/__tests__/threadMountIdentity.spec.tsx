/**
 * MOUNT IDENTITY — the two conversation surfaces' thread CONTAINERS must not
 * share one testid.
 *
 * ⚠ SCOPE, STATED SO NOTHING LARGER IS READ INTO A GREEN RUN HERE: every case
 * below is about the container's own `data-testid`. Descendant testids are
 * built from content alone and are NOT split per host — `suggested-chip-*`
 * included — so a document-wide query for a descendant is still ambiguous
 * while both hosts are mounted. The full statement, and the reason the broad
 * fix was not taken, is in the mount-identity note in `zones/ChatThread.tsx`.
 *
 * ⚠ WHAT IS AND IS NOT CLAIMED HERE. A COUNT of mounts is not a visibility
 * claim, so jsdom can make it (CLAUDE.md trap 3 bans the other kind). The
 * geometry — that the hidden twin is `display:none`, 0x0 and NOT hit-testable —
 * is measured only in real Chromium by
 * `e2e/geometry/threadAutoScroll.measure.ts`, and it matters because it splits
 * the original hypothesis in two: a human click can never land on the twin
 * (no box, no hit target), but anything selecting BY TESTID can, and the "dead
 * affordance" sighting that started this lane came from an instrumented
 * session, not a finger.
 *
 * THE DEFECT, derived at the bytes. `ConversationPanel` has two production
 * hosts — `OlumiTabBody.tsx:106` (docked) and `FloatingOlumiPanel.tsx:1079`
 * (floating) — and they are NOT mutually exclusive. `dockHostsOlumi`
 * (`olumiSurface.ts:80-84`) pre-empts the floating host only when the dock is
 * open AND its tab is `olumi`; on every other tab the docked host stays mounted
 * behind `hidden` (`OutputsDock.tsx:3271-3279`) while the floating one renders.
 * `olumiSurface.ts:4-5` claims "exactly one may be VISIBLE" — never that only
 * one may be MOUNTED. Both threads answered to `chat-thread`.
 *
 * The chain has three links and each one is pinned below, because a chain with
 * an untested link is where the drift goes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ChatThread, THREAD_TESTID_DOCKED, THREAD_TESTID_FLOATING } from '../zones/ChatThread'
import { ConversationPanel } from '../ConversationPanel'
import type { ConversationMessage } from '../types'
import type { UseConversationReturn } from '../useConversation'

/**
 * ⚠ WITHOUT THIS MOCK THIS FILE COLLECTS ZERO TESTS AND THE SUITE STAYS GREEN.
 * `ChatThread`/`ConversationPanel` reach `services/threadService.ts` →
 * `lib/supabase.ts`, which THROWS at module scope without
 * `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (`supabase.ts:38`) — a
 * COLLECTION-time death that a multi-file run's aggregate total hides
 * (CLAUDE.md trap 2b). Measured on this branch before the mock was added: this
 * file failed at collect. Mirrors the sibling
 * `FloatingOlumiPanel.threadIdentity.spec.tsx`.
 */
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

vi.mock('../../../adapters/plot', () => ({
  plot: { validatePatch: vi.fn() },
}))

const messages: ConversationMessage[] = [
  { id: 'a1', role: 'assistant', content: 'Here is a first read.' } as ConversationMessage,
]

function threadProps(testId?: string) {
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    nodeCount: 12,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: vi.fn(),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
    ...(testId ? { testId } : {}),
  } as unknown as React.ComponentProps<typeof ChatThread>
}

function conversationStub(): UseConversationReturn {
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    sendMessage: vi.fn(),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    retryLast: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  } as unknown as UseConversationReturn
}

describe('the two conversation hosts do not share one data-testid', () => {
  beforeEach(() => {
    // jsdom implements no layout and therefore no scrollIntoView; useSmartScroll
    // calls it on commit. Stubbing it keeps this file's claims about IDENTITY
    // and never about geometry.
    Element.prototype.scrollIntoView = vi.fn()
  })

  /**
   * ⭐ COLLECTION GUARD — this file's OWN cases, by name. A hand-written list
   * on purpose: it cannot be derived from the thing it checks, and it fails
   * loud if the set grows OR shrinks (CLAUDE.md trap 12's sanctioned form).
   */
  it('COLLECTION GUARD — all five cases in this file were collected, by name', (ctx) => {
    const siblings = ctx.task.suite?.tasks ?? []
    const names = siblings.map((t) => t.name)
    expect(names).toEqual([
      'COLLECTION GUARD — all five cases in this file were collected, by name',
      'the two identities are DIFFERENT strings — the whole point, asserted before anything relies on it',
      'LINK 1 — ChatThread answers to the identity it is given, and to no other',
      'LINK 2 — ConversationPanel forwards the identity through to its thread',
      'LINK 2b — and defaults to the canonical identity when no surface is named',
    ])
    // A skipped case is still COLLECTED, so the name list alone cannot see
    // one being quietly parked — measured: `it.skip` left the list identical
    // and the guard green. Assert the mode too, or the guard is narrower than
    // its own name (CLAUDE.md trap 13b — a guard agreeing with itself).
    expect(
      siblings.filter((t) => t.mode !== 'run').map((t) => t.name),
      'a case in this file is skipped/todo — it is collected but it is not evidence',
    ).toEqual([])
  })

  it('the two identities are DIFFERENT strings — the whole point, asserted before anything relies on it', () => {
    expect(THREAD_TESTID_DOCKED).not.toBe(THREAD_TESTID_FLOATING)
  })

  it('LINK 1 — ChatThread answers to the identity it is given, and to no other', () => {
    // Both surfaces mounted at once, exactly as the reachable state produces
    // them. Bind by the EXACT testid, never by index or by "the first thread"
    // (CLAUDE.md trap 19).
    const { container } = render(
      <>
        <ChatThread {...threadProps()} />
        <ChatThread {...threadProps(THREAD_TESTID_FLOATING)} />
      </>,
    )

    expect(
      container.querySelectorAll(`[data-testid="${THREAD_TESTID_DOCKED}"]`).length,
      'two live threads answer to the canonical testid — every probe that selects it is ambiguous, ' +
        'and one of the two is the invisible twin',
    ).toBe(1)
    expect(
      container.querySelectorAll(`[data-testid="${THREAD_TESTID_FLOATING}"]`).length,
      'the floating thread has no identity of its own',
    ).toBe(1)
  })

  it('LINK 2 — ConversationPanel forwards the identity through to its thread', () => {
    const { container } = render(
      <ConversationPanel
        conversation={conversationStub()}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
        hideComposer
        compact
        threadTestId={THREAD_TESTID_FLOATING}
      />,
    )

    expect(
      container.querySelector(`[data-testid="${THREAD_TESTID_FLOATING}"]`),
      'ConversationPanel swallowed the surface identity — the floating host cannot name its own thread',
    ).not.toBeNull()
    expect(
      container.querySelector(`[data-testid="${THREAD_TESTID_DOCKED}"]`),
      'the panel rendered the CANONICAL identity for a host that is not the canonical surface',
    ).toBeNull()
  })

  it('LINK 2b — and defaults to the canonical identity when no surface is named', () => {
    // The discriminating twin for LINK 2: without it, a panel that hardcoded
    // the floating id would satisfy the case above.
    const { container } = render(
      <ConversationPanel
        conversation={conversationStub()}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
        hideComposer
        compact
      />,
    )
    expect(container.querySelector(`[data-testid="${THREAD_TESTID_DOCKED}"]`)).not.toBeNull()
    expect(container.querySelector(`[data-testid="${THREAD_TESTID_FLOATING}"]`)).toBeNull()
  })
})
