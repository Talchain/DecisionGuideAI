/**
 * V11: the revealed views and the team's evidence drawn on the card they are about (./reveal.ts says where and which). With core's
 * `collab.marks`, each mark is a chip on the card's rail below it, in core's own short words ("Priya and Tom differ", "Only Maya raised it",
 * "Priya and Tom added evidence") with the people's initials; a card with two marks has two chips. Views no chip gathers are initials in the
 * card's marks row. Selecting either opens it in the dock (the Team tab). Every word is core's: the person's name, their figure's label and
 * text, core's heading for the effect, core's words for the mark.
 */
import { FileText, GitFork } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { CARD_WIDTH } from './layout'
import { marksOn, openChipOf, revealOf, useReveal, type CardChip, type Mark } from './reveal'
import { evidenceOn } from './evidence'

/** Nothing opens on an earlier version: it is drawn as it was, without the dock. */
const onEarlier = () => useViewStore.getState().at !== null

/** Open one view in the dock (and, from a chip, the card it concerns and which of its chips: its ring is the one selection ring). */
export function openView(id: number, card: string | null = null, chip: string | null = null): void {
  if (onEarlier()) return
  useReveal.getState().select(id, card, chip)
  useUIStore.getState().forceActivateOutputTab('team')
}

/** Open one piece of evidence in the dock (from a chip, with the card it sits on and that chip). */
export function openEvidence(id: number, card: string | null = null, chip: string | null = null): void {
  if (onEarlier()) return
  useReveal.getState().selectEvidence(id, card, chip)
  useUIStore.getState().forceActivateOutputTab('team')
}

/**
 * V11 change 1: each piece of evidence the team shared, on the cards it concerns, as a document mark in the card's marks row (beside the
 * people's initials). Its hover and accessible name are who brought it and their words, as given. Evidence core already gathers in an
 * evidence chip on this card is drawn by that chip, never twice.
 */
export function CardEvidenceMarks({ card }: { card: string }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const open = useReveal((s) => s.evidence)
  const chipped = new Set(marksOn(revealOf(view), card).cardChips.flatMap((c) => c.evidence))
  const items = evidenceOn(view, card).filter((e) => !chipped.has(e.id))
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

const initial = (by: string) => (Array.from(by)[0] ?? '').toUpperCase()
/** The chips' row: wide enough for two chips side by side. */
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
  return { ...marksOn(revealOf(view), card), view, selected, heading }
}

/** Overlapping initials for the people a chip gathers (a duo reads as one group). */
function People({ people }: { people: CardChip['people'] }): JSX.Element {
  return (
    <span aria-hidden="true" className="inline-flex flex-none">
      {people.map((p, i) => <span key={p.id} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-panel-border bg-canvas text-text-body ${i > 0 ? '-ml-1.5' : ''}`}>{initial(p.by)}</span>)}
    </span>
  )
}

/** The people whose view sits on this card and no chip gathers, as initials in its marks row. */
export function CardViewInitials({ card }: { card: string }): JSX.Element | null {
  const { initials, selected, heading } = useMarks(card)
  if (initials.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`reveal-initials-${card}`}>
      {initials.map((m) => {
        const on = selected === m.view, words = markWords(m, heading(m))
        return (
          <button key={`${m.view}`} type="button" aria-pressed={on} aria-label={words} title={words} data-reveal-initial={m.view} data-reveal-status={m.status ?? undefined}
            onClick={(e) => { e.stopPropagation(); openView(m.view) }}
            className={`pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border bg-canvas ${typography.viewLabel} text-text-body transition-colors duration-fast hover:border-text-header ${on ? 'border-text-header ring-1 ring-text-header' : 'border-panel-border'}`}>
            {initial(m.by)}
          </button>
        )
      })}
    </span>
  )
}

/** Core's marks on this card's rail, just below it, out of flow, so no card moves; else the interim per-person chips. */
export function CardViewChips({ card }: { card: string }): JSX.Element | null {
  const { chips, cardChips, view, heading } = useMarks(card)
  const open = useReveal((s) => s)
  const openChip = openChipOf(revealOf(view), open)
  const rail = (children: JSX.Element[]) => (
    // Centred under the card, side by side in ONE row inside the gap to the next row (a second row would sit on the cards below); two
    // chips may reach past the card's edges. The first (the difference that matters most) keeps all its words; a later one gives way and
    // ends in an ellipsis, its full words in its hover and its name.
    <div className="nodrag mt-1 flex flex-row flex-nowrap justify-center gap-1.5" style={{ width: CHIPS_WIDTH, marginLeft: (CARD_WIDTH - CHIPS_WIDTH) / 2 }} data-testid={`reveal-chips-${card}`}>{children}</div>
  )
  if (cardChips.length > 0) {
    return rail(cardChips.map((chip, i) => {
      // Each person's figure, or each piece of evidence in its bringer's words, is the hover beneath core's words for the mark.
      const detail = chip.kind === 'evidence'
        ? chip.evidence.flatMap((id) => { const e = view?.evidence.find((x) => x.id === id); return e === undefined ? [] : [`${e.by} · ${e.text}`] })
        : chips.filter((m) => chip.views.includes(m.view)).map((m) => markWords(m, heading(m)))
      const hover = [chip.text, ...detail].join('\n')
      // No ring of its own when open: the card's ring is the one selection ring (approved v2.1); the open chip is raised.
      const on = openChip?.key === chip.key
      return (
        <button key={chip.key} type="button" aria-pressed={on} aria-label={hover.replace(/\n/g, ' · ')} title={hover} data-reveal-card-chip={card} data-reveal-kind={chip.kind}
          data-reveal-chip={chip.kind === 'evidence' ? undefined : chip.views[0]} data-reveal-evidence-chip={chip.kind === 'evidence' ? chip.evidence[0] : undefined}
          onClick={(e) => { e.stopPropagation(); if (chip.kind === 'evidence') openEvidence(chip.evidence[0]!, card, chip.key); else openView(chip.views[0]!, card, chip.key) }}
          className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${i === 0 ? 'flex-none' : 'min-w-0'} ${on ? 'shadow-2' : ''}`}>
          <People people={chip.people} />
          <span className="truncate" data-reveal-chip-text="">{chip.text}</span>
        </button>
      )
    }))
  }
  if (chips.length === 0) return null
  // Interim, for a core without `collab.marks`: one chip per person on the card they differ on.
  return rail(chips.map((m, i) => {
    const on = open.selected === m.view
    return (
      <button key={`${m.view}:${m.figure?.quantity ?? ''}`} type="button" aria-pressed={on} aria-label={m.chip ?? markWords(m, heading(m))} title={m.chip ?? markWords(m, heading(m))}
        data-reveal-chip={m.view} data-reveal-status={m.status ?? undefined}
        onClick={(e) => { e.stopPropagation(); openView(m.view) }}
        className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${i === 0 ? 'flex-none' : 'min-w-0'} ${on ? 'border-text-header ring-1 ring-text-header' : 'border-text-header'}`}>
        <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">{initial(m.by)}</span>
        <GitFork aria-hidden="true" className="h-3 w-3 flex-none text-text-body" />
        {/* On the board, who and their figure, in core's words; core's sentence for a changed leader (`chip`) is the hover and the label for
            readers, and leads the dock (it runs to two lines and more, too long for a marker on a link). */}
        <span className="truncate">{m.figure === null ? m.by : `${m.by}: ${m.figure.text}`}</span>
      </button>
    )
  }))
}

/**
 * Approved v2.1: "Where the case has chances: the option card itself shows '71% → 34% with Priya's range' ... The panel does not repeat it."
 * While a chip is open, each option card core names in that mark's `options` (core f3aedd9a) shows core's words for it, under its chance.
 * Nothing is drawn from an older core, and nothing is composed here.
 */
export function OptionMarkLine({ card }: { card: string }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const open = useReveal((s) => s)
  if (open.card === null) return null
  const text = openChipOf(revealOf(view), open)?.options.find((o) => o.option === card)?.text ?? null
  if (text === null) return null
  return <p className={`${typography.viewLabel} mt-1 font-medium text-text-header`} data-reveal-option-line={card}>{text}</p>
}
