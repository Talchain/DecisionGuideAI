/**
 * Browser-side probe for the D-2 CHAT ARM (build train #70 5855068711, slice D, R7): the REAL `ChatThread`, fed
 * the five SERVED turns in `chat-served-turns.bf-20260927.json` (#2175's fixture, producer bytes) through the
 * SHIPPED chain — parse → route → map → phase-3 bridge → chips → sidecars — at a dock width, with every disclosure
 * open. jsdom returns 0 for every rect, so this class of defect is invisible to the unit suite by construction.
 *
 * Mounted through Vite (the `threadMountProbe` pattern) so bare imports resolve. Not collected by any test config:
 * it exports a function and asserts nothing; `chatServedGeometry.measure.ts` asserts.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

import { ChatThread } from '../../src/canvas/conversation/zones/ChatThread'
import type { ConversationMessage } from '../../src/canvas/conversation/types'
import { parseV5Response } from '../../src/v5/responseParser'
import { routeV5Response } from '../../src/v5/responseRouter'
import { mapV5Blocks } from '../../src/v5/blocks/mapV5Blocks'
import { extractPhase3FromV5Response, deriveV5AnalysisFactUpdate } from '../../src/v5/extractPhase3FromV5Response'
import { buildSuggestedActionChips } from '../../src/v5/blocks/suggestedActionChips'
import { composePhase3BridgedBlocks } from '../../src/canvas/conversation/useConversation'
import { extractAnswerShapeSidecar } from '../../src/canvas/conversation/answerShape'
import { extractOpenQuestionListSidecar } from '../../src/canvas/conversation/serverOpenQuestions'
import served from '../../src/canvas/conversation/__tests__/fixtures/chat-served-turns.bf-20260927.json'

type Wire = Record<string, unknown>

export interface Offender { kind: 'overhang' | 'clipped' | 'covered'; testid: string | null; tag: string; text: string; detail: string }
export interface ChatGeometryReading {
  width: number
  turns: number
  messages: number
  elements: number
  buttons: number
  disclosuresOpened: number
  menusChecked: number
  threadScroll: { scrollWidth: number; clientWidth: number }
  offenders: Offender[]
  errors: string[]
}

async function messageFrom(body: Wire, i: number): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(`turn ${i} routed to ${target.kind}`)
  const response = target.response
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response)
  const fact = deriveV5AnalysisFactUpdate(response, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const answerShape = extractAnswerShapeSidecar(response)
  const openQuestionList = extractOpenQuestionListSidecar(response)
  return {
    id: `a${i}`,
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    ...(openQuestionList ? { openQuestionList } : {}),
    timestamp: new Date(Date.UTC(2026, 8, 27, 10, 14, i)),
  } as ConversationMessage
}

const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms))

function describe(el: Element): Pick<Offender, 'testid' | 'tag' | 'text'> {
  let tid: string | null = el.getAttribute('data-testid')
  for (let p = el.parentElement; !tid && p; p = p.parentElement) tid = p.getAttribute('data-testid')
  return { testid: tid, tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) }
}

/** The stacking contexts between an element and the thread: where its z-index stops counting. */
function stackingChain(el: Element, stop: Element): string {
  const out: string[] = []
  for (let a = el.parentElement; a && a !== stop; a = a.parentElement) {
    const c = getComputedStyle(a)
    const why = [
      c.position !== 'static' && c.zIndex !== 'auto' ? `z ${c.zIndex}` : '',
      c.transform !== 'none' ? 'transform' : '',
      c.filter !== 'none' || c.backdropFilter !== 'none' ? 'filter' : '',
      Number(c.opacity) < 1 ? `opacity ${c.opacity}` : '',
      c.isolation === 'isolate' ? 'isolate' : '',
      c.contain.includes('paint') || c.contain.includes('layout') ? `contain ${c.contain}` : '',
      c.willChange !== 'auto' ? `will-change ${c.willChange}` : '',
      c.contentVisibility === 'auto' ? 'content-visibility' : '',
    ].filter(Boolean)
    if (why.length) out.push(`${a.tagName.toLowerCase()}[${a.getAttribute('data-testid') ?? ''}](${why.join(',')})`)
  }
  return out.join(' < ') || 'none'
}

/** Inside a container that is MEANT to scroll sideways (a table, code), overhang is by design. */
function insideSidewaysScroller(el: Element, stop: Element): boolean {
  for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX
    if (ox === 'auto' || ox === 'scroll') return true
  }
  return false
}

export async function measureServedChat(width: number): Promise<ChatGeometryReading> {
  document.getElementById('measure-host')?.remove()
  const host = document.createElement('div')
  host.id = 'measure-host'
  host.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:800px;display:flex;flex-direction:column;z-index:99999;background:#fff`
  document.body.appendChild(host)

  const errors: string[] = []
  const origErr = console.error
  console.error = (...a: unknown[]) => { errors.push(String(a[0]).slice(0, 300)); origErr(...a) }

  const turns = served as Array<{ source: string; body: Wire }>
  const messages: ConversationMessage[] = []
  for (let i = 0; i < turns.length; i++) {
    messages.push({ id: `u${i}`, role: 'user', content: 'Paul’s message', timestamp: new Date(Date.UTC(2026, 8, 27, 10, 14, i)) } as ConversationMessage)
    messages.push(await messageFrom(turns[i]!.body, i))
  }

  const root = createRoot(host)
  flushSync(() => {
    root.render(
      createElement(ChatThread, {
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
      } as unknown as React.ComponentProps<typeof ChatThread>),
    )
  })
  await settle(600)

  const thread = host.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
  if (!thread) throw new Error('chat-thread did not mount')

  // Open every disclosure (each press can reveal another).
  let opened = 0
  for (let round = 0; round < 6; round++) {
    // Content disclosures only: a message's "…" menu (aria-haspopup) is a popup, checked one at a time below.
    const closed = [...thread.querySelectorAll<HTMLElement>('[aria-expanded="false"]:not([aria-haspopup])')]
    if (closed.length === 0) break
    for (const b of closed) { b.click(); opened++ }
    await settle()
  }
  await settle(500)

  const offenders: Offender[] = []
  const tr = thread.getBoundingClientRect()
  const all = [...thread.querySelectorAll<HTMLElement>('*')]

  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue

    // (a) overhang: an element's box past the thread's right edge (the dock would clip it).
    if (r.right > tr.right + 1 && !insideSidewaysScroller(el, thread)) {
      offenders.push({ kind: 'overhang', ...describe(el), detail: `right ${Math.round(r.right)} > thread ${Math.round(tr.right)}` })
    }

    // (b) clipped text without an ellipsis or a line clamp. Only boxes that clip and hold text of their own.
    const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip'
    const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip'
    const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0)
    if ((clipsX || clipsY) && (ownText || el.querySelector('span, p, a, strong, em'))) {
      const overX = clipsX && el.scrollWidth > el.clientWidth + 1
      const overY = clipsY && el.scrollHeight > el.clientHeight + 1
      const ellipsis = cs.textOverflow === 'ellipsis'
      const clamp = cs.getPropertyValue('-webkit-line-clamp').trim()
      const clamped = clamp !== '' && clamp !== 'none'
      if ((overX && !ellipsis) || (overY && !clamped)) {
        offenders.push({ kind: 'clipped', ...describe(el), detail: `scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}; text-overflow ${cs.textOverflow}; line-clamp ${clamp || 'none'}` })
      }
    }
  }

  // (c) every ENABLED control is hit-testable at its centre once scrolled into view. A disabled or inert control
  // (`pointer-events: none` by design: a stale coaching action) is not a press target, so it is not checked.
  const pressable = (b: HTMLElement) => !(b as HTMLButtonElement).disabled && getComputedStyle(b).pointerEvents !== 'none'
  const hitCheck = async (b: HTMLElement): Promise<void> => {
    b.scrollIntoView({ block: 'center', inline: 'nearest' })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const r = b.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) {
      offenders.push({ kind: 'covered', ...describe(b), detail: `centre (${Math.round(x)},${Math.round(y)}) is outside the viewport after scrollIntoView` })
      return
    }
    const hit = document.elementFromPoint(x, y)
    if (hit === null || !(b === hit || b.contains(hit))) {
      offenders.push({ kind: 'covered', ...describe(b), detail: `centre hits ${hit ? `${hit.tagName.toLowerCase()}[${hit.getAttribute('data-testid') ?? ''}] "${(hit.textContent ?? '').trim().slice(0, 40)}"` : 'nothing'}; stacking contexts: ${stackingChain(b, thread)}` })
    }
  }
  const buttons = [...thread.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')].filter(pressable)
  for (const b of buttons) await hitCheck(b)

  // (c, menus) each message's "…" menu, ONE AT A TIME (a user can only open one): its items must be pressable.
  const triggers = [...thread.querySelectorAll<HTMLElement>('[data-testid="message-menu-trigger"]')]
  let menusChecked = 0
  for (const t of triggers) {
    // As a real click leaves it: the trigger focused, so the quiet-at-rest slot is revealed by `focus-within`
    // (ChatMessage MENU_QUIET_AT_REST). A bare DOM click() moves no focus and would measure an invisible menu.
    t.focus()
    t.click()
    await settle(300)
    const items = [...thread.querySelectorAll<HTMLElement>('[data-testid="message-menu-items"] button')].filter(pressable)
    for (const it of items) await hitCheck(it)
    if (items.length > 0) menusChecked++
    t.click()
    t.blur()
    await settle(200)
  }

  const reading: ChatGeometryReading = {
    width,
    turns: turns.length,
    messages: thread.querySelectorAll('[data-testid="chat-message-assistant"]').length,
    elements: all.length,
    buttons: buttons.length,
    disclosuresOpened: opened,
    menusChecked,
    threadScroll: { scrollWidth: thread.scrollWidth, clientWidth: thread.clientWidth },
    offenders,
    errors,
  }
  console.error = origErr
  root.unmount()
  host.remove()
  return reading
}
