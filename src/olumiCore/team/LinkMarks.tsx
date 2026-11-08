/**
 * ONE CHIP PER LINK (DL 8 Nov, V11 #13; core API v1.30 `collab.link_marks`, olumi-core PR #22). After the reveal, each link members said they
 * doubt or keep is one chip, in core's words, the single source of that link's chip:
 * - on the line, where core draws the link as a line (`line`): the line whose `links[].holds` is the mark's `link`, once;
 * - on the card that folds the link, where the board draws it as no line (`line: false`, `card`), in that card's one rail.
 * Every word is core's, as given:
 * - on the chip, `text` ("Bea doubts this link");
 * - on hover, each holder's stance in their own words (`title`), what the model cannot calculate (`status_text`), Olumi's reading where core
 *   gives one (never, for a link: no Run computes a link chip) and the chip's one closing question (`question`), each whole, in that order;
 * - in its name, the chip, then the stances (`label`), the status and the question, each whole and apart.
 * Chips and differences are matched on records: a link's key is core's own record for it in the differences (`link:<record>[:<part>]`,
 * core debate.ts:359). A link this canvas draws a chip for no longer gets TM-04's card chip (CardDiffers.tsx); a mark with no line or card
 * here leaves that chip as it was, so `differences[].chip` is still read until core drops it. Before the reveal, while gated (core serves
 * no marks) or on an earlier version, nothing is drawn.
 */
import { useMemo } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'

export type LinkMark = NonNullable<View['collab']['link_marks']>[number]
type LinkRef = { readonly record: string; readonly part: string | null }

/** A link's key: core's own record for it in the differences (`link:<record>[:<part>]`, debate.ts:359). */
export const linkKeyOf = (l: LinkRef): string => `link:${l.record}${l.part ? `:${l.part}` : ''}`

const NONE: readonly LinkMark[] = []
const said = (x: unknown): x is string => typeof x === 'string' && x !== ''
const sameLink = (a: LinkRef | null | undefined, b: LinkRef): boolean => a != null && a.record === b.record && (a.part ?? null) === (b.part ?? null)

/** The View's link marks in core's order, once per link (a second mark for one link is never drawn); a mark whose words are not words is
 *  dropped, never drawn as anything else. */
export function linkMarksOf(view: View | null): readonly LinkMark[] {
  const all = view?.collab?.link_marks
  if (!Array.isArray(all) || all.length === 0) return NONE
  const seen = new Set<string>()
  const out = all.filter((m) => {
    if (m === null || typeof m !== 'object' || !said(m.text) || m.link == null || !said(m.link.record) || !Array.isArray(m.stances)) return false
    const k = linkKeyOf(m.link)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return out.length === 0 ? NONE : out
}

/** The mark drawn on line `links[i]`: core's line mark whose link this line holds (`links[].holds`), on the first line that holds it, so it
 *  is drawn once. */
export function lineMarkOf(view: View | null, i: number): LinkMark | null {
  const links = view?.model?.links
  const holds = links?.[i]?.holds
  if (links == null || holds == null) return null
  const m = linkMarksOf(view).find((x) => x.line && sameLink(holds, x.link))
  if (m === undefined) return null
  return links.findIndex((l) => sameLink(l.holds, m.link)) === i ? m : null
}

/** The marks core folds onto this card (`line: false`, `card`): a link the board draws as no line, held in the card's badge. */
export function foldedMarksOn(view: View | null, card: string): readonly LinkMark[] {
  const marks = linkMarksOf(view)
  if (marks.length === 0 || !(view?.model?.cards ?? []).some((c) => c.id === card)) return NONE
  const on = marks.filter((m) => !m.line && m.card === card)
  return on.length === 0 ? NONE : on
}

/** The links this canvas draws a chip for: a line mark on a line that holds its link, a folded one on a card the board shows. */
export function placedKeysOf(view: View | null): ReadonlySet<string> {
  const out = new Set<string>()
  const links = view?.model?.links ?? [], cards = view?.model?.cards ?? []
  for (const m of linkMarksOf(view)) {
    const placed = m.line ? links.some((l) => sameLink(l.holds, m.link)) : m.card !== null && cards.some((c) => c.id === m.card)
    if (placed) out.add(linkKeyOf(m.link))
  }
  return out
}

/** The chip's hover: core's strings, each whole, in this order (UI, 8 Nov: "reading and question in the hover"); nothing composed here. */
export function markHover(m: LinkMark): string {
  const parts: string[] = []
  if (said(m.title)) parts.push(m.title)
  if (said(m.status_text)) parts.push(m.status_text)
  if (m.reading != null && said(m.reading.text)) { parts.push(m.reading.text); if (said(m.reading.note)) parts.push(m.reading.note) }
  if (said(m.question)) parts.push(m.question)
  return parts.join('\n')
}

const quoted = (s: string) => s.replace(/["\\]/g, '\\$&')

/** Selecting a chip opens the dock's Team tab at what the team can do about the link: its difference, where one member doubts it and another
 *  keeps it, else the form where a member says where they stand on a link. Nothing opens on an earlier version. */
export function openLinkMark(m: LinkMark): void {
  if (useViewStore.getState().at !== null) return
  useUIStore.getState().forceActivateOutputTab('team')
  const k = quoted(linkKeyOf(m.link))
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const at = document.querySelector(`[data-testid="team-difference-${k}"], [data-testid^="team-difference-${k}-"]`) ?? document.querySelector('[data-testid="team-link-stance"]')
    at?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }))
}

/**
 * One link's chip, drawn as the reveal's chips are: a mark in the circle where they have initials (a broken link where anyone doubts the
 * link, a whole one where it is only kept), then core's words, whole, at their natural width. `at` is where it sits: 'line', or the card
 * that folds the link. On a line it keeps one line; on a card's rail, were core's words ever wider than the card, they would wrap inside the
 * chip, never cut.
 */
export function LinkMarkChip({ m, at }: { m: LinkMark; at: string }): JSX.Element {
  const Mark = m.stances.some((s) => s.stance === 'doubt') ? Unlink2 : Link2
  return (
    <button type="button" title={markHover(m)} data-link-mark={linkKeyOf(m.link)} data-link-mark-at={at} data-link-mark-kind={m.kind}
      onClick={(e) => { e.stopPropagation(); openLinkMark(m) }}
      className={`pointer-events-auto inline-flex min-h-6 max-w-full flex-none cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel py-0.5 pl-0.5 pr-2.5 text-left ${at === 'line' ? 'whitespace-nowrap' : ''} ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2`}>
      <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">
        <Mark className="h-3 w-3" />
      </span>
      <span data-link-mark-text="">{m.text}</span>
      {said(m.label) ? <>{' '}<span className="sr-only" data-link-mark-label="">{m.label}</span></> : null}
      {said(m.status_text) ? <>{' '}<span className="sr-only" data-link-mark-status="">{m.status_text}</span></> : null}
      {said(m.question) ? <>{' '}<span className="sr-only" data-link-mark-question="">{m.question}</span></> : null}
    </button>
  )
}

/** The View shown, or null on an earlier version (drawn as it was, with no chip of a link). */
function useShownView(): View | null {
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  return at === null ? view : null
}

/** The mark on line `links[i]`, or null. */
export function useLineMark(i: number): LinkMark | null {
  const view = useShownView()
  return useMemo(() => lineMarkOf(view, i), [view, i])
}

/** The marks folded onto this card. */
export function useFoldedMarks(card: string): readonly LinkMark[] {
  const view = useShownView()
  return useMemo(() => foldedMarksOn(view, card), [view, card])
}

/** The links this canvas draws a chip for (their keys). */
export function usePlacedKeys(): ReadonlySet<string> {
  const view = useShownView()
  return useMemo(() => placedKeysOf(view), [view])
}
