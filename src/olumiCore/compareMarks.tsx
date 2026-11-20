/**
 * THE VERSION DIFF ON THE CANVAS (DL 14:43Z, 19 Nov; compare concept v3 "the canvas is drawn as the difference"). While the Compare tab
 * shows two approved versions, every card core's own change lines name (`/compare` ChangeLine `record_id`, frozen shape from core
 * wip/x-compare-core) carries one small mark: "Changed since version N". Its hover is core's own line, verbatim (text, then detail). The page
 * infers nothing: a card is marked only where core names its id, a removed card (absent from the version on screen) is never drawn, and the
 * mark is gone the moment the tab stops showing that pair. It sits in the card's bottom marks band (BaseNode's BottomCardMark, beside the
 * run-change badge), never over the card's top connection handle (live check, 19 Nov: a top-edge pill hid part of its words). No AI call; no number; no colour of Olumi's (the mark is the person's ink).
 */
import { create } from 'zustand'
import { useViewStore } from '../olumiView/store'
import { typography } from '../styles/typography'
import { OkIcon } from '../olumiView/look/icons'
import { BottomCardMark } from '../canvas/nodes/shared/CardMark'
import { Hover } from '../olumiView/look/Hover'

/** One of core's change lines, as the mark's hover says it. */
export type MarkedLine = { text: string; detail: string }
type Marks = { sid: string | null; from: number | null; to: number | null; byId: Record<string, MarkedLine[]> }
const NONE: Marks = { sid: null, from: null, to: null, byId: {} }

export const useCompareMarks = create<Marks & { show: (m: Marks) => void; clear: () => void }>((set) => ({
  ...NONE,
  show: (m) => set(m),
  clear: () => set(NONE),
}))

/** Core's change lines grouped by the record each names; a line with no `record_id` (a top-level field) names no card and is not marked. */
export function marksOf(lines: { text: string; detail: string; record_id?: string | null }[]): Record<string, MarkedLine[]> {
  const out: Record<string, MarkedLine[]> = {}
  for (const l of lines) {
    if (typeof l.record_id !== 'string' || l.record_id === '') continue
    ;(out[l.record_id] ??= []).push({ text: l.text, detail: l.detail })
  }
  return out
}

/** Fixed chrome: the mark's words. Every other word on it is core's. */
export const changedSince = (from: number) => `Changed since version ${from}`

/**
 * The mark on one card: drawn only for the scenario the comparison is about, while the canvas shows the comparison's later version (`to`),
 * and only where core named this card. It enters the card's bottom marks band (BottomCardMark) ONLY when drawn: the band registers a mark
 * as soon as a BottomCardMark mounts, so an always-mounted wrapper would reserve band space on every card of the older look.
 */
export function CompareCardMark({ id }: { id: string }): JSX.Element | null {
  const m = useCompareMarks()
  const sid = useViewStore((s) => s.sid)
  const shownN = useViewStore((s) => s.view?.version?.n ?? null)
  const lines = m.byId[id]
  if (!lines || m.sid === null || m.sid !== sid || m.to === null || m.from === null || shownN !== m.to) return null
  const hover = lines.map((l) => (l.detail ? `${l.text}\n${l.detail}` : l.text)).join('\n')
  return (
    // One line, bounded by the band (BaseNode right-insets it clear of the card's action rail): the words truncate rather than wrap, since the band
    // reserves one line (6 + 27 * scale) and a second would grow upward over the card. The full words stay in the hover.
    // The registry's version icon (`version-tag`, "Core's version label"): the mark names a version. Grey, decorative beside the words.
    <BottomCardMark>
      {/* The hover is the one Tip (core's lines, verbatim). The card around it is already the keyboard stop and the same lines are in the tab's list, so the mark takes no focus of its own. */}
      <Hover words={hover} focusable={false} className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-text-light bg-panel px-2 py-0.5 text-text-header ${typography.viewLabel}`}
        data-compare-mark={id} data-compare-from={m.from} data-compare-to={m.to}><span className="inline-flex shrink-0"><OkIcon id="version-tag" size={12} decorative /></span><span className="truncate">{changedSince(m.from)}</span></Hover>
    </BottomCardMark>
  )
}
