/**
 * Browser-side probe for the thread's auto-scroll, mounted through Vite.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT `page.evaluate` SOURCE. `page.evaluate` source
 * is never processed by Vite, so a bare `react` specifier fails to resolve in
 * the page (measured: "Failed to resolve module specifier 'react'"). A module
 * under the Vite root IS transformed, so its imports resolve — which is what
 * lets the probe mount the REAL `ChatThread` with the REAL `useSmartScroll`
 * rather than a fixture of the thread written by hand (CLAUDE.md trap 16: a
 * self-authored fixture encodes the author's model of the producer).
 *
 * Not collected by any test config: it exports a function and asserts nothing.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ChatThread } from '../../src/canvas/conversation/zones/ChatThread'
import type { ConversationMessage } from '../../src/canvas/conversation/types'

export interface ThreadReading {
  domLen: number
  testids: (string | null)[]
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
  chip: {
    rect: { w: number; h: number; y: number }
    inView: boolean
    hitTestable: boolean
    label: string | null
  } | null
}

const settle = () => new Promise((r) => setTimeout(r, 450))

function read(): ThreadReading | null {
  const el = document.querySelector('#measure-host [data-testid="chat-thread"]') as HTMLElement | null
  if (!el) return null
  const listRect = el.getBoundingClientRect()
  // Bind to the chip BY ITS OWN TESTID, never by index or position — another
  // button in the thread could satisfy a positional predicate (trap 19).
  const chipBtn = el.querySelector('[data-testid="suggested-chip-run_analysis"]') as HTMLElement | null
  let chip: ThreadReading['chip'] = null
  if (chipBtn) {
    const r = chipBtn.getBoundingClientRect()
    const hit = r.width > 0 && r.height > 0
      ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      : null
    chip = {
      rect: { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) },
      // IN VIEW = the chip's box lies within the thread's visible band.
      inView: r.height > 0 && r.top >= listRect.top - 1 && r.bottom <= listRect.bottom + 1,
      hitTestable: hit !== null && chipBtn.contains(hit),
      label: chipBtn.textContent?.trim().slice(0, 40) ?? null,
    }
  }
  return {
    domLen: el.innerHTML.length,
    testids: [...el.querySelectorAll('[data-testid]')].map(n => n.getAttribute('data-testid')).slice(0, 25),
    scrollTop: Math.round(el.scrollTop),
    scrollHeight: Math.round(el.scrollHeight),
    clientHeight: Math.round(el.clientHeight),
    distanceFromBottom: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop),
    chip,
  }
}

/**
 * Mount the real thread, then grow the reply the way the producer grows it.
 *
 * Growth shape derived from `useConversation`, not invented: the streaming path
 * creates ONE placeholder assistant message (`isStreaming: true`,
 * useConversation.ts:5928) and then grows it by MUTATION — `text_delta` →
 * `scheduleStreamFlush` → content, `block` → `updateMessage(msgId, {blocks})`
 * (useConversation.ts:5962-5985). `messages.length` is constant across every
 * one of those commits, and so is ChatThread's `renderedMessageCount`.
 */
export async function measureThreadGrowth(): Promise<Record<string, unknown>> {
  const host = document.createElement('div')
  host.id = 'measure-host'
  host.style.cssText =
    'position:fixed;top:0;left:0;width:420px;height:600px;display:flex;flex-direction:column;z-index:99999;background:#fff'
  document.body.appendChild(host)

  const LONG = 'The board wants a decision by Friday and the numbers disagree. '.repeat(45)

  const msgs = (assistantContent: string, chips: unknown[]): ConversationMessage[] =>
    ([
      { id: 'u1', role: 'user', content: 'Should we replace our CRM?' },
      { id: 'a1', role: 'assistant', content: assistantContent, isStreaming: false, actionChips: chips },
    ] as unknown as ConversationMessage[])

  const props = (messages: ConversationMessage[]) =>
    ({
      messages,
      isThinking: false,
      longRunningHint: null,
      nodeCount: 12,
      patchBlockStates: new Map(),
      patchRejections: new Map(),
      onChipClick: async () => {},
      onPatchAccept: () => {},
      onPatchDismiss: () => {},
      onFeedback: () => {},
      onRetry: () => {},
      compact: true,
    }) as unknown as React.ComponentProps<typeof ChatThread>

  const errs: string[] = []
  const origErr = console.error
  console.error = (...a: unknown[]) => { errs.push(String(a[0]).slice(0, 300)); origErr(...a) }
  ;(window as unknown as { __probeErrs: string[] }).__probeErrs = errs

  const root = createRoot(host)

  // Commit 1 — the reply exists and is short. This is the commit the count
  // trigger CAN see (renderedMessageCount 0 → 2).
  root.render(createElement(ChatThread, props(msgs('Here is a first read of your decision.', []))))
  await settle()
  const afterShort = read()

  // Commit 2 — THE COMMIT THAT MATTERS. Same message id, same array length: the
  // reply grows and the chips arrive on it.
  root.render(
    createElement(
      ChatThread,
      props(msgs('Here is a first read of your decision.\n\n' + LONG, [
        { id: 'run_analysis', label: 'Run analysis', intent: 'primary', message: 'Run the analysis' },
      ])),
    ),
  )
  await settle()
  await settle()
  const afterGrowth = read()

  const outerLen = host.innerHTML.length
  const outerHead = host.innerHTML.slice(0, 400)
  console.error = origErr
  root.unmount()
  host.remove()
  return { afterShort, afterGrowth, errs: errs.slice(0, 5), outerLen, outerHead }
}
