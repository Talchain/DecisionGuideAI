/**
 * A revealed stance on a link (core `collab.link_marks`, olumi-core PR #22, API v1.30): one chip on the line it is about ("Priya doubts
 * this link"), core's words whole, each holder's stance in their own words as its hover and name (`title`, `label`). The chip is found by
 * the line's `holds` (the record and part it stands for), never by its two ends: two lines between the same cards are different links.
 * A mark core sets off the line (`line: false`) is drawn on its card instead (RevealMarks), never here.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { EdgeLabelRenderer } from '@xyflow/react'
import { typography } from '../styles/typography'
import { linkWordsAt } from '../canvas/edges/linkWordsPlace'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../canvas/utils/goalChanceDriverLinks'
import type { View, ViewLink } from './client'
import { useViewStore } from './store'

type Box = { readonly id?: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type LinkMark = NonNullable<View['collab']['link_marks']>[number]
const initial = (by: string) => by.trim().charAt(0).toUpperCase()

/** Core's mark for this line, keyed on the record (and part) the line holds; null when core sends none, or keeps it off the line. */
export function linkMarkOf(view: View | null, link: Pick<ViewLink, 'holds'>): LinkMark | null {
  const h = link.holds ?? null
  if (view === null || h === null) return null
  return view.collab.link_marks?.find((m) => m.line && m.link.record === h.record && m.link.part === h.part) ?? null
}

export function LinkMarkChip({ i, link, path, cards, midX, midY }: { i: number; link: ViewLink; path: string; cards: readonly Box[]; midX: number; midY: number }): JSX.Element | null {
  const mark = useViewStore((s) => linkMarkOf(s.view, link))
  const [size, setSize] = useState({ w: 0, h: 0 })
  const seen = useRef<ResizeObserver | null>(null)
  const attach = useCallback((el: HTMLDivElement | null) => {
    seen.current?.disconnect(); seen.current = null
    if (!el) return
    const read = () => setSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
    read()
    if (typeof ResizeObserver !== 'undefined') { seen.current = new ResizeObserver(read); seen.current.observe(el) }
  }, [])
  // At the point along the line nearest its middle where the chip touches no card and no card's chip rail (the edge passes the rails as
  // obstacles, railBoxes.ts), and not this line's own words: the link words' own rule (linkWordsPlace.ts).
  const at = useMemo(() => (size.w === 0 ? null : linkWordsAt(path, cards, size, { x: midX, y: midY })), [path, cards, size, midX, midY])
  if (mark === null) return null
  const people = [...new Map(mark.stances.map((s) => [s.by_id, s.by] as const)).entries()]
  return (
    <EdgeLabelRenderer>
      <div ref={attach} role="note" aria-label={mark.label} title={mark.title} data-link-mark={`links.${i}`} data-link-mark-kind={mark.kind}
        className={`nodrag nopan inline-flex min-h-6 max-w-[240px] items-center gap-1.5 rounded-[12px] border border-panel-border bg-panel py-0.5 pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1`}
        style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${at?.x ?? midX}px, ${at?.y ?? midY}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, pointerEvents: 'auto', ...(at === null ? { visibility: 'hidden' as const } : {}) }}>
        <span aria-hidden="true" className="inline-flex flex-none">
          {people.map(([pid, by], k) => <span key={pid} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${k > 0 ? '-ml-1.5' : ''}`}>{initial(by)}</span>)}
        </span>
        <span className="min-w-0" data-view={`collab.link_marks.${link.holds?.record}.text`}>{mark.text}</span>
      </div>
    </EdgeLabelRenderer>
  )
}

/** Core's marks kept off the line (`line: false`): drawn on the card core names (`card`), in its chip rail. */
export function cardLinkMarksOf(view: View | null, card: string): LinkMark[] {
  return view?.collab.link_marks?.filter((m) => !m.line && m.card === card) ?? []
}

export function LinkMarkCardChip({ mark }: { mark: LinkMark }): JSX.Element {
  const people = [...new Map(mark.stances.map((s) => [s.by_id, s.by] as const)).entries()]
  return (
    <span role="note" aria-label={mark.label} title={mark.title} data-link-mark-card={mark.card ?? undefined} data-link-mark-kind={mark.kind}
      className={`pointer-events-auto inline-flex min-h-6 min-w-0 flex-1 items-center gap-1.5 rounded-[12px] border border-panel-border bg-panel py-0.5 pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1`}>
      <span aria-hidden="true" className="inline-flex flex-none">
        {people.map(([pid, by], k) => <span key={pid} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${k > 0 ? '-ml-1.5' : ''}`}>{initial(by)}</span>)}
      </span>
      <span className="min-w-0">{mark.text}</span>
    </span>
  )
}
