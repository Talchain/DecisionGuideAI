/**
 * v10's ring on the core lane: a class (`v10-lit`) on each lit card's own node. Its own module, importing only layout.ts's pure pickers
 * (already in the chat's import closure), so the chat (in the dock's import closure) does not pull in the card components
 * (shell-conformance).
 *
 * Three hands light cards, each its own slot, and a card is lit while any of them holds it, so none ever clears another's:
 *   - RESTING (`restRing`): the NEWEST reply's next step keeps its cards lit at rest, so the line and its cards read as one without the
 *     person pointing at anything (track 4 step 2, DL 7 Nov: "when a coaching move names a record, highlight that card");
 *   - POINTED (`pointRing`, `endRing`; `ringCards` is the same slot under its v10 name): the person points at (hovers or focuses) a reply's
 *     next step, and exactly its cards are lit INSTEAD of the resting ones; leaving restores the resting ring;
 *   - TAB (`attCards`): the Reasoning tab's glance, the cards whose marks are hovered or focused and every card of a kind whose row is
 *     pressed, lit beside whatever the chat lights.
 * One focus per screen: a card the person selects steps out of the RESTING ring only (layout.ts `restingRingOf`; the card Olumi's note is
 * open on steps out in ViewChat, which reads that store). While a V11 view chip is open (`v11-open`, a person reading a view), the whole
 * resting ring steps out (UI ruling 7 Nov, on v11-build's question): the open view is the one focus. A pointed or tab card is the person's own
 * gesture, so it stays lit even when it is selected (pressing a glance mark selects its card, and its ring stays).
 * No words are added and no second Olumi badge: the ring is v10's outline (index.css `.v10-lit`), nothing dims.
 * React Flow rewrites a node's class (select, drag, a late mount), which drops a class added by hand; while any slot holds a card, ONE
 * watcher repaints, and it stops when nothing is held. The paint compares before it writes, so its own writes cannot loop.
 */
import { restingRingOf } from './layout'

let resting: readonly string[] = [] // the newest reply's cards, lit at rest
let pointed: readonly string[] | null = null // a reply's next step the person points at: null = none (an empty list lights nothing, and hides the resting ring)
let tab: readonly string[] = [] // the Reasoning tab's glance
let watcher: MutationObserver | null = null
let watched: Element | null = null

// A page without CSS.escape (jsdom) still finds the card: its id with quotes and backslashes escaped.
const escId = (s: string): string => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : s.replace(/["\\]/g, (c) => `\\${c}`))
const nodeOf = (id: string): Element | null => document.querySelector(`.react-flow__node[data-id="${escId(id)}"]`)
const idOf = (el: Element): string => el.getAttribute('data-id') ?? ''

/** The cards that should be lit now: the pointed ones whole, else the resting ones less any in the person's focus; and the tab's, always. */
function wanted(): ReadonlySet<string> {
  const viewOpen = document.querySelector('.react-flow__node.v11-open') !== null
  const inFocus = Array.from(document.querySelectorAll('.react-flow__node.selected'), idOf)
  return new Set([...(pointed ?? (viewOpen ? [] : restingRingOf(resting, inFocus))), ...tab])
}

/** Make the canvas match: take the ring off every lit card nobody wants, put it on every wanted card that lacks it. Idempotent. */
function paint(): void {
  if (typeof document === 'undefined') return
  const want = wanted()
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => { if (!want.has(idOf(el))) el.classList.remove('v10-lit') })
  for (const id of want) {
    const node = nodeOf(id)
    if (node !== null && !node.classList.contains('v10-lit')) node.classList.add('v10-lit')
  }
  watch()
}

/** Watch the canvas while any slot holds a card (rooted at React Flow once it is mounted, else the body); stop when none does. */
function watch(): void {
  const on = resting.length + (pointed === null ? 0 : pointed.length) + tab.length > 0
  if (!on || typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    watcher?.disconnect()
    watcher = null
    watched = null
    return
  }
  const root = document.querySelector('.react-flow') ?? document.body
  if (watcher !== null && watched === root) return
  watcher?.disconnect()
  watcher = new MutationObserver(paint)
  watched = root
  watcher.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
}

/** The newest reply's cards stay lit at rest; none clears. */
export function restRing(ids: readonly string[]): void { resting = [...ids]; paint() }
/** A reply's next step is pointed at: exactly its cards are lit (not the resting ones). */
export function pointRing(ids: readonly string[]): void { pointed = [...ids]; paint() }
/** Pointing ended: back to the newest reply's cards, or none. */
export function endRing(): void { pointed = null; paint() }
/** The chat's pointed ring under its v10 name: light exactly these cards for the chat (none, to clear its own), beside the tab's. */
export function ringCards(ids: readonly string[]): void { pointed = ids.length === 0 ? null : [...ids]; paint() }
/** The Reasoning tab's ring: light exactly these cards for the tab (none, to clear its own), beside whatever the chat lights. */
export function attCards(ids: readonly string[]): void { tab = [...ids]; paint() }