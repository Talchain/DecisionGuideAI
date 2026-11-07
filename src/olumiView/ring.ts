/**
 * v10's ring on the core lane: the cards a reply's next step is about (core's `chat[].answer.next.about`) are lit, and only those. Its own
 * module, importing only layout.ts's pure pickers (already in the chat's import closure), so the chat (in the dock's import closure) does
 * not pull in the card components (shell-conformance).
 *
 * COACHING ON ITS CARD (track 4 step 2, DL 7 Nov: "when a coaching move names a record, highlight that card, so Olumi and the canvas act
 * as one partner"): the NEWEST reply's next step keeps its cards lit at rest (`restRing`), so the line and its cards read as one without
 * the person pointing at anything. Pointing at any reply's next step lights exactly its cards (`pointRing`) and leaving restores the
 * newest reply's (`endRing`). A card the person selects steps out of the resting ring (one focus per screen). No words are added and no
 * second Olumi badge: the ring is v10's outline (index.css `.v10-lit`), nothing dims. Which cards is layout.ts's to pick (`nextCardsOf`, the
 * one adapter the DL's coaching field replaces; `restingRingOf`); this module only applies it, and puts it back when React Flow rewrites a
 * card's class.
 */
import { restingRingOf } from './layout'

/** Light exactly these cards (v10's ring, a class on each card's own node), and only these: none, to clear. */
export function ringCards(ids: readonly string[]): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => el.classList.remove('v10-lit'))
  // A page without CSS.escape (jsdom) still finds the card: its id with quotes and backslashes escaped.
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape : (s: string) => s.replace(/["\\]/g, (c) => `\\${c}`)
  for (const id of ids) document.querySelector(`.react-flow__node[data-id="${esc(id)}"]`)?.classList.add('v10-lit')
}

let resting: readonly string[] = [] // the newest reply's cards, lit at rest
let pointed: readonly string[] | null = null // a reply's next step the person points at (hover or focus)
let watcher: MutationObserver | null = null
let queued = false

const escId = (s: string): string => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : s.replace(/["\\]/g, (c) => `\\${c}`))
const nodeOf = (id: string): Element | null => document.querySelector(`.react-flow__node[data-id="${escId(id)}"]`)

/** What should be lit: the pointed cards whole; otherwise layout.ts's resting ring given the cards in the person's focus: selected (React
 *  Flow's `selected` class) or with a V11 view chip open on them (`v11-open`, v11-build's mark; the open chip wins, one focus per screen).
 *  Already right (every lit card wanted, every wanted card on the canvas lit) writes nothing, so its own write cannot loop. */
function paint(): void {
  if (typeof document === 'undefined') return
  const selected = Array.from(document.querySelectorAll('.react-flow__node.selected, .react-flow__node.v11-open'), (e) => e.getAttribute('data-id') ?? '')
  const want = pointed ?? restingRingOf(resting, selected)
  const lit = Array.from(document.querySelectorAll('.react-flow__node.v10-lit'), (e) => e.getAttribute('data-id') ?? '')
  if (lit.every((id) => want.includes(id)) && want.every((id) => nodeOf(id)?.classList.contains('v10-lit') ?? true)) return
  ringCards(want)
}
/** React Flow rewrites a node's className (select, drag, a late mount); an AT-REST ring is put back on the next microtask. paint() compares
 *  first, so its own write cannot loop. Watching only while something should be lit. */
function watch(): void {
  const on = resting.length > 0 || pointed !== null
  if (on && watcher === null && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    watcher = new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; paint() }) })
    watcher.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  } else if (!on && watcher !== null) { watcher.disconnect(); watcher = null }
}

/** The newest reply's cards stay lit at rest; none clears. */
export function restRing(ids: readonly string[]): void { resting = ids; watch(); paint() }
/** A reply's next step is pointed at: exactly its cards are lit. */
export function pointRing(ids: readonly string[]): void { pointed = ids; watch(); paint() }
/** Pointing ended: back to the newest reply's cards, or none. */
export function endRing(): void { pointed = null; watch(); paint() }

