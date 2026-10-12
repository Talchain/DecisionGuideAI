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
