/**
 * V11: the revealed views drawn on the card they are about (./reveal.ts says where and which). On the card, the people whose view sits there
 * as initials in its marks row; below it, on its outgoing link, the consequential disagreement as a chip: with core's `collab.marks`, one
 * chip per card in core's own short words ("Priya and Tom differ") with the people's initials. Selecting either opens that view
 * in the dock (the Team tab). Every word is core's: the person's name, their figure's label and text, core's heading for the effect.
 */
import { FileText, GitFork } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { CARD_WIDTH } from './layout'
import { marksOn, revealOf, useReveal, type Mark } from './reveal'
import { evidenceOn } from './evidence'

/** Open one view in the dock (and, from a chip, the card it concerns: its ring is the one selection ring). */
export function openView(id: number, card: string | null = null): void {
  useReveal.getState().select(id, card)
  useUIStore.getState().forceActivateOutputTab('team')
}

/** Open one piece of evidence in the dock. */
export function openEvidence(id: number): void {
  useReveal.getState().selectEvidence(id)
  useUIStore.getState().forceActivateOutputTab('team')
}

/**
 * V11 change 1: each piece of evidence the team shared, on the cards it concerns, as a document mark in the card's marks row (beside the
 * people's initials). Its hover and accessible name are who brought it and their words, as given.
 */
export function CardEvidenceMarks({ card }: { card: string }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const open = useReveal((s) => s.evidence)
  const items = evidenceOn(view, card)
  if (items.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`evidence-marks-${card}`}>
      {items.map((e) => {
        const on = open === e.id, words = `${e.by} · ${e.text}`
        return (
          <button key={e.id} type="button" aria-pressed={on} aria-label={words} title={e.source === null ? words : `${words} · ${e.source}`} data-evidence-mark={e.id}
            onClick={(ev) => { ev.stopPropagation(); openEvidence(e.id) }}
            className={`pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header ${on ? 'border-text-header ring-1 ring-text-header' : 'border-panel-border'}`}>
            <FileText aria-hidden="true" className="h-3 w-3" />
          </button>
        )
      })}
    </span>
  )
}

const initial = (by: string) => by.slice(0, 1).toUpperCase()
/** The chips' row: wide enough for two people's chips side by side. */
const CHIPS_WIDTH = Math.max(CARD_WIDTH, 380)

/** What a mark says on hover and to a reader: the person, their figure in core's words, core's heading for its effect. */
function markWords(m: Mark, heading: string | null): string {
  const fig = m.figure === null ? null : `${m.figure.label}: ${m.figure.text}`
  return [m.by, fig, heading].filter((x): x is string => x !== null && x !== '').join(' · ')
}

function useMarks(card: string) {
  const view = useViewStore((s) => s.view)
  const selected = useReveal((s) => s.selected)
  const headings = view?.collab.effect_headings ?? null
  const heading = (m: Mark) => (headings === null || m.status === null ? null : headings[m.status])
  return { ...marksOn(revealOf(view), card), selected, heading }
}

/** Overlapping initials for the people a chip gathers (a duo reads as one group). */
function People({ people }: { people: readonly { readonly view: number; readonly by: string }[] }): JSX.Element {
  return (
    <span aria-hidden="true" className="inline-flex flex-none">
      {people.map((p, i) => <span key={p.view} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${i > 0 ? '-ml-1.5' : ''}`}>{initial(p.by)}</span>)}
    </span>
  )
}

/** The people whose view sits on this card, as initials in its marks row. */
export function CardViewInitials({ card }: { card: string }): JSX.Element | null {
  const { initials, selected, heading, words } = useMarks(card)
  if (initials.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`reveal-initials-${card}`}>
      {initials.map((m) => {
        const on = selected === m.view
        return (
          <button key={`${m.view}`} type="button" aria-pressed={on} aria-label={words === null ? markWords(m, heading(m)) : `${words} · ${markWords(m, heading(m))}`}
            title={words === null ? markWords(m, heading(m)) : `${words}\n${markWords(m, heading(m))}`} data-reveal-initial={m.view} data-reveal-status={m.status ?? undefined}
            onClick={(e) => { e.stopPropagation(); openView(m.view) }}
            className={`pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border bg-canvas ${typography.viewLabel} text-text-body transition-colors duration-fast hover:border-text-header ${on ? 'border-text-header ring-1 ring-text-header' : 'border-panel-border'}`}>
            {initial(m.by)}
          </button>
        )
      })}
    </span>
  )
}

/** The consequential disagreement on this card's outgoing link: a chip just below the card, out of flow, so no card moves. */
export function CardViewChips({ card }: { card: string }): JSX.Element | null {
  const { chips, chip, selected, heading } = useMarks(card)
  if (chip !== null) {
    // Core's one mark for the card (collab.marks): its own short words and the people it gathers; each person's figure is its hover.
    const on = selected !== null && chip.views.includes(selected)
    const hover = [chip.text, ...chips.map((m) => markWords(m, heading(m)))].join('\n')
    // No ring of its own when open: the card's ring is the one selection ring (approved v2.1).
    return (
      <div className="nodrag mt-1 flex justify-center" style={{ width: CHIPS_WIDTH, marginLeft: (CARD_WIDTH - CHIPS_WIDTH) / 2 }} data-testid={`reveal-chips-${card}`}>
        <button type="button" aria-pressed={on} aria-label={hover.replace(/\n/g, ' · ')} title={hover} data-reveal-chip={chip.views[0]} data-reveal-card-chip={card}
          data-reveal-kind={chip.kind} onClick={(e) => { e.stopPropagation(); openView(chip.views[0]!, card) }}
          className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${on ? 'shadow-2' : ''}`}>
          <People people={chip.people} />
          <span className="truncate" data-reveal-chip-text="">{chip.text}</span>
        </button>
      </div>
    )
  }
  if (chips.length === 0) return null
  return (
    // Centred under the card, on its outgoing links, side by side inside the gap to the next row (out of flow: no card moves). Two people
    // who differ on one card are two chips in one row, so the row may reach past the card's edges.
    <div className="nodrag mt-1 flex flex-row flex-wrap justify-center gap-1.5" style={{ width: CHIPS_WIDTH, marginLeft: (CARD_WIDTH - CHIPS_WIDTH) / 2 }} data-testid={`reveal-chips-${card}`}>
      {chips.map((m) => {
        const on = selected === m.view
        return (
          <button key={`${m.view}:${m.figure?.quantity ?? ''}`} type="button" aria-pressed={on} aria-label={m.chip ?? markWords(m, heading(m))} title={m.chip ?? markWords(m, heading(m))}
            data-reveal-chip={m.view} data-reveal-status={m.status ?? undefined}
            onClick={(e) => { e.stopPropagation(); openView(m.view) }}
            className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${on ? 'border-text-header ring-1 ring-text-header' : 'border-text-header'}`}>
            <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">{initial(m.by)}</span>
            <GitFork aria-hidden="true" className="h-3 w-3 flex-none text-text-body" />
            {/* On the board, who and their figure, in core's words; core's sentence for a changed leader (`chip`) is the hover and the label for
                readers, and leads the dock (it runs to two lines and more, too long for a marker on a link). */}
            <span className="truncate">{m.figure === null ? m.by : `${m.by}: ${m.figure.text}`}</span>
          </button>
        )
      })}
    </div>
  )
}
