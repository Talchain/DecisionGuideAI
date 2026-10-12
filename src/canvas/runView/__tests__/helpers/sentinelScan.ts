/**
 * #2747 re-scope 2 (U1): read a mounted surface the way a person and assistive technology read it, for the sentinel census.
 * Text is the rendered text (screen-reader-only text included); "aria" is every accessible-name, value and title
 * attribute. Every disclosure (`aria-expanded="false"`) is opened first, so an absence is never read off a closed door.
 */
import { act, fireEvent } from '@testing-library/react'

const ARIA_ATTRS = ['aria-label', 'aria-valuetext', 'aria-valuenow', 'aria-description', 'title', 'alt', 'placeholder']

/** Open every closed disclosure inside `root`, repeatedly (a door can hold doors), up to a bound. */
export function openEveryDisclosure(root: ParentNode): number {
  let opened = 0
  for (let round = 0; round < 8; round++) {
    const closed = [...root.querySelectorAll<HTMLElement>('[aria-expanded="false"]')]
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true')
    if (closed.length === 0) break
    for (const el of closed) {
      act(() => { fireEvent.click(el) })
      opened += 1
    }
  }
  return opened
}

/**
 * The surface's text and aria. `text` is the rendered text as one run (for CEE's served words, which must appear whole);
 * `spaced` joins every text node with a space, so an element boundary separates what it separates on screen — without it
 * "Sensitive assumptions: 0." beside "86%" reads "0.86%" and hides the 86% (the base census on a1efd4a, LensInfoPanel).
 * Every negative check reads both.
 */
export function readSurface(root: Element): { text: string; spaced: string; aria: string } {
  const aria: string[] = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of ARIA_ATTRS) {
      const v = el.getAttribute(attr)
      if (v) aria.push(v)
    }
  }
  const nodes: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) if (n.textContent) nodes.push(n.textContent)
  return {
    text: (root.textContent ?? '').replace(/\s+/g, ' '),
    spaced: nodes.join(' ').replace(/\s+/g, ' '),
    aria: aria.join(' | '),
  }
}

/**
 * #2747 re-scope 2 round 2 (B): the components React actually RENDERED under `root`, by name, read off the fiber tree
 * (React 18 stores the root fiber on the container under `__reactContainer$…`). The census records these across every row
 * so a chance-reading component that no row renders is visible as such — never assumed mounted because it is imported.
 */
export function renderedComponentNames(container: Element): Set<string> {
  const names = new Set<string>()
  const key = Object.keys(container).find(k => k.startsWith('__reactContainer$'))
  type Fiber = { type?: unknown; child?: Fiber | null; sibling?: Fiber | null; stateNode?: { current?: Fiber } | null }
  // The container holds the HostRoot fiber as it was at createRoot; the committed tree is its FiberRoot's `current`.
  const stored = key === undefined ? null : (container as unknown as Record<string, Fiber>)[key]
  const start = stored?.stateNode?.current ?? stored ?? null
  const nameOf = (t: unknown): string | null => {
    if (typeof t === 'function') return (t as { displayName?: string; name?: string }).displayName || (t as { name?: string }).name || null
    if (t !== null && typeof t === 'object') {
      const o = t as { displayName?: string; render?: unknown; type?: unknown }
      return o.displayName || nameOf(o.render) || nameOf(o.type)
    }
    return null
  }
  const stack: Fiber[] = start ? [start] : []
  while (stack.length > 0) {
    const f = stack.pop()!
    const n = nameOf(f.type)
    if (n) names.add(n)
    if (f.child) stack.push(f.child)
    if (f.sibling) stack.push(f.sibling)
  }
  return names
}

/** CEE's served strings removed from a text, longest first, so what remains is what the UI wrote itself. */
export function withoutServed(text: string, served: readonly string[]): string {
  let out = text
  for (const s of [...served].sort((a, b) => b.length - a.length)) if (s.length > 0) out = out.split(s).join(' ‖ ')
  return out
}

/**
 * #2747 re-scope 2 round 2 (B): read a surface in EVERY state a person can put it in without typing: every disclosure
 * opened (`openEveryDisclosure`) and every tab selected in turn (`role="tab"` with `aria-selected="false"`, re-queried
 * after each click because a tab switch re-renders the strip). Round 1's census opened disclosures only, so a section under
 * an unselected tab (the Results lenses) was never read. `onState` runs in each state (the census records the rendered
 * components there).
 */
export function exploreSurface(root: Element, onState?: () => void): { text: string; spaced: string; aria: string; states: number } {
  const text: string[] = []
  const spaced: string[] = []
  const aria: string[] = []
  const take = () => {
    openEveryDisclosure(root)
    const r = readSurface(root)
    text.push(r.text)
    spaced.push(r.spaced)
    aria.push(r.aria)
    onState?.()
  }
  take()
  const visited = new Set<string>()
  const keyOf = (t: Element) => `${t.getAttribute('id') ?? ''}|${t.getAttribute('aria-controls') ?? ''}|${(t.textContent ?? '').trim()}`
  for (let i = 0; i < 40; i++) {
    const next = [...root.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="false"]')]
      .find(t => !t.hasAttribute('disabled') && t.getAttribute('aria-disabled') !== 'true' && !visited.has(keyOf(t)))
    if (next === undefined) break
    visited.add(keyOf(next))
    act(() => { fireEvent.click(next) })
    take()
  }
  return { text: text.join(' ‖ '), spaced: spaced.join(' ‖ '), aria: aria.join(' ‖ '), states: text.length }
}
