/**
 * OLUMI'S NEXT STEP, BESIDE THE CARD IT IS ABOUT (dgai-on-core G6). Core names the one card a reply's next step sits beside
 * (`chat[].answer.next.at`: exactly one `about` on the canvas, else null); this page draws that next step there as Olumi's note
 * (`OlumiAttentionCard`), in core's words: its label as the title, its text as the body. Nothing is chosen here: no card when core
 * names none, and only the newest reply's step. A question in it is answered on the note, and the answer is said to core in the chat.
 */
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../canvas/store'
import { clearOlumiAttention, requestOlumiAttention, type OlumiAttentionNote } from '../canvas/utils/olumiAttention'
import { isForThisPage, useMe } from '../olumiCore/me'
import type { View } from './client'
import { useViewStore } from './store'

/** Every note this page draws from a View has a turn id with this prefix, so it never clears a note another surface asked for. */
const VIEW_NOTE = 'olumi-view-next:'

/** The newest reply's next step and the card core puts it beside; null when core names no card. */
export function nextNoteOf(view: View): { key: string; at: string; note: OlumiAttentionNote } | null {
  const turn = view.chat.find((t) => t.answer?.next.newest === true)
  const next = turn?.answer?.next
  if (!turn || !next || next.at === null) return null
  // The cites are core's references (drawn as marks in the chat), not words: the note says the words.
  const body = next.text.map((p) => ('text' in p ? p.text : '')).join('').trim()
  if (body === '') return null
  return { key: `${VIEW_NOTE}${view.id}:${turn.id}`, at: next.at, note: { title: next.label, body } }
}

/** On the core lane: the newest reply's next step, drawn once beside its card; dismissed, it stays dismissed for that reply. */
export function useViewNote(on: boolean): void {
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const next = on && view !== null && isForThisPage(view, me) ? nextNoteOf(view) : null
  // The card is drawn by the View canvas; the note waits for it.
  const anchored = useCanvasStore((s) => next !== null && s.nodes.some((n) => n.id === next.at))
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!on) return
    const held = useCanvasStore.getState().olumiAttention
    const ours = held?.turnId?.startsWith(VIEW_NOTE) === true
    // A newer reply with no card, or another scenario: this page's last note is no longer Olumi's current next step.
    if (ours && held!.turnId !== next?.key) clearOlumiAttention()
    if (next === null || !anchored || shown.current === next.key) return
    if (requestOlumiAttention({ nodeIds: [next.at], note: next.note, turnId: next.key }).applied.length > 0) shown.current = next.key
  }, [on, next?.key, anchored]) // eslint-disable-line react-hooks/exhaustive-deps -- `next` is keyed by its reply
}
