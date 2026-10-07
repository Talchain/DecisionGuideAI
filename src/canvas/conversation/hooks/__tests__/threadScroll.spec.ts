/**
 * `threadScroll.ts` — the chat thread scrolls itself and nothing else (S-F; the 7 Oct blank-chat witness: the dock's
 * overflow-hidden `aside` sat at scrollTop 906 during every pending turn because the thread pinned itself with
 * `scrollIntoView`, which scrolls every scrollable ancestor).
 *
 * (1) The owner's arithmetic, with explicit geometry (jsdom has none).
 * (2) THE GUARD: no conversation source may call `scrollIntoView` except the two named fallbacks, each for a target
 *     that is NOT in a thread. Contrast: the owner itself is used, so a scanner that saw nothing cannot pass.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { scrollThreadToEnd, scrollWithinThread, THREAD_SCROLLER_ATTRIBUTE } from '../threadScroll'

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect
}

function threadWith(targetTop: number, targetHeight = 40) {
  const thread = document.createElement('div')
  thread.setAttribute(THREAD_SCROLLER_ATTRIBUTE, '')
  thread.scrollTop = 200
  thread.getBoundingClientRect = () => rect(100, 600)
  const scrollTo = vi.fn()
  ;(thread as unknown as { scrollTo: unknown }).scrollTo = scrollTo
  const target = document.createElement('div')
  target.getBoundingClientRect = () => rect(targetTop, targetHeight)
  target.scrollIntoView = vi.fn()
  thread.appendChild(target)
  const outer = document.createElement('aside')
  ;(outer as unknown as { scrollTo: unknown }).scrollTo = vi.fn()
  outer.appendChild(thread)
  return { thread, target, scrollTo, outer }
}

describe('threadScroll: only the thread moves', () => {
  it('block start: the target top lands at the thread top', () => {
    const { target, scrollTo, outer } = threadWith(500)
    expect(scrollWithinThread(target, { behavior: 'smooth', block: 'start' })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ top: 200 + 400, behavior: 'smooth' })
    expect((outer as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).not.toHaveBeenCalled()
    expect(target.scrollIntoView).not.toHaveBeenCalled()
  })

  it('block nearest: a target already in view does not move anything', () => {
    const { target, scrollTo } = threadWith(300)
    expect(scrollWithinThread(target, { behavior: 'smooth', block: 'nearest' })).toBe(true)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('block nearest: a target below the fold is brought up just enough to show its bottom', () => {
    const { target, scrollTo } = threadWith(720, 40) // bottom 760 vs thread bottom 700 → +60
    scrollWithinThread(target, { behavior: 'auto', block: 'nearest' })
    expect(scrollTo).toHaveBeenCalledWith({ top: 200 + 60, behavior: 'auto' })
  })

  it('block nearest: a target above the fold is brought down to the thread top', () => {
    const { target, scrollTo } = threadWith(40) // 60 above the thread top
    scrollWithinThread(target, { behavior: 'auto', block: 'nearest' })
    expect(scrollTo).toHaveBeenCalledWith({ top: 200 - 60, behavior: 'auto' })
  })

  it('a target outside any thread: nothing is scrolled and the caller is told', () => {
    const loose = document.createElement('div')
    loose.scrollIntoView = vi.fn()
    expect(scrollWithinThread(loose, { behavior: 'auto', block: 'start' })).toBe(false)
    expect(loose.scrollIntoView).not.toHaveBeenCalled()
  })

  it('the end pin writes the thread only, asking for its full height (the browser clamps)', () => {
    const { thread, scrollTo, outer } = threadWith(0)
    Object.defineProperty(thread, 'scrollHeight', { value: 1500, configurable: true })
    scrollThreadToEnd(thread, 'smooth')
    expect(scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'smooth' })
    expect((outer as unknown as { scrollTo: ReturnType<typeof vi.fn> }).scrollTo).not.toHaveBeenCalled()
  })
})

// ── THE GUARD ───────────────────────────────────────────────────────────────

const CONVERSATION_ROOT = 'src/canvas/conversation'
/** Each allowed `scrollIntoView` and why it cannot reach a thread. */
const ALLOWED: Record<string, string> = {
  'src/canvas/conversation/InlineBlocks.tsx': 'fallback only when the citation target is NOT inside a thread',
  'src/canvas/conversation/utils/scrollToField.ts': 'inspector fields, which live in the inspector, never a thread',
}

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__') continue
      out.push(...sources(p))
    } else if (/\.tsx?$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

describe('GUARD: nothing in the conversation scrolls the dock', () => {
  it('no scrollIntoView call outside the named fallbacks; the owner is in use (contrast)', () => {
    const files = sources(CONVERSATION_ROOT)
    expect(files.length, 'the scanner saw no sources').toBeGreaterThan(50)
    const offenders: string[] = []
    let ownerUses = 0
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      const calls = text.split('\n').filter((l) => /\.scrollIntoView\s*\(/.test(l) && !/^\s*(\/\/|\*)/.test(l))
      if (calls.length > 0 && !(f in ALLOWED)) offenders.push(`${f}: ${calls[0].trim()}`)
      if (/scrollThreadToEnd\(|scrollWithinThread\(/.test(text) && !f.endsWith('threadScroll.ts')) ownerUses++
    }
    expect(offenders, 'scrollIntoView moves every scrollable ancestor, the dock included — use threadScroll.ts').toEqual([])
    expect(ownerUses, 'contrast: the owner is used by the conversation (useSmartScroll, ConversationPanel, InlineBlocks)').toBeGreaterThanOrEqual(3)
  })
})
