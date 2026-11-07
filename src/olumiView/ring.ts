/**
 * v10's ring on the core lane: a class on each lit card's own node. Two hands light cards, each its own slot, and a card is lit while
 * either holds it, so neither ever clears the other's:
 *   - the chat: the cards a reply's next step is about (core's `chat[].answer.next.about`);
 *   - the Reasoning tab's glance: the cards whose marks are hovered or focused, and every card of a kind whose row is pressed.
 * React Flow rebuilds a node's class whenever its own state changes (selecting the card from its mark does), which drops a class added
 * by hand; while anything is lit, a watcher on the canvas puts the ring back on any lit card that lost it, and stops when nothing is.
 * Its own module, importing nothing, so the chat (in the dock's import closure) does not pull in the card components (shell-conformance).
 */

let chat: readonly string[] = []
let tab: readonly string[] = []
let watcher: MutationObserver | null = null

// A page without CSS.escape (jsdom) still finds the card: its id with quotes and backslashes escaped.
const esc = (s: string): string => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : s.replace(/["\\]/g, (c) => `\\${c}`))

/** Put the ring on every lit card that lacks it. Adding nothing the second time round, it never wakes the watcher again. */
function relight(): void {
  for (const id of new Set([...chat, ...tab])) {
    const node = document.querySelector(`.react-flow__node[data-id="${esc(id)}"]`)
    if (node !== null && !node.classList.contains('v10-lit')) node.classList.add('v10-lit')
  }
}

function light(): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => el.classList.remove('v10-lit'))
  relight()
  if (chat.length + tab.length === 0 || typeof MutationObserver === 'undefined') { watcher?.disconnect(); watcher = null; return }
  if (watcher === null) {
    watcher = new MutationObserver(relight)
    watcher.observe(document.querySelector('.react-flow') ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  }
}

/** The chat's ring: light exactly these cards for the chat (none, to clear its own), beside whatever the Reasoning tab lights. */
export function ringCards(ids: readonly string[]): void {
  chat = [...ids]
  light()
}

/** The Reasoning tab's ring: light exactly these cards for the tab (none, to clear its own), beside whatever the chat lights. */
export function attCards(ids: readonly string[]): void {
  tab = [...ids]
  light()
}
