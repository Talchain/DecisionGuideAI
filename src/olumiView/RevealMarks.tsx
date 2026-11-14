/**
 * V11: the revealed views and the team's evidence drawn on the card they are about (./reveal.ts says where and which). With core's
 * `collab.marks`, each mark is a chip on the card's rail below it, in core's own short words ("Priya and Tom differ", "Only Maya raised it",
 * "Priya and Tom added evidence") with the people's initials; a card with two marks has two chips. Views no chip gathers are initials in the
 * card's marks row. Selecting either opens it in the dock (the Team tab). Every word is core's, whole (N3): each mark's hover and name, each
 * figure's and each piece of evidence's own, never composed here.
 */
import { SELECTED_RING } from '../styles/selected'
import { FileText, GitFork, Users } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../canvas/store'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { CARD_WIDTH, cardLinkMarksOf, evidenceOffChips, unmarkedDiffers } from './layout'
import { noteLanded } from './revealReturn'
import { marksOn, openChipOf, revealOf, useReveal, type CardChip, type Mark } from './reveal'
import { evidenceOn } from './evidence'
import { strategyMarkOn } from './strategy/strategy'
import { DifferChip, railLayout, useLinkDiffers } from '../olumiCore/team/CardDiffers'
import { useRailBoxesRef } from './railBoxes'
import { LinkMarkCardChip } from './LinkMarkChip'

/** Nothing opens on an earlier version: it is drawn as it was, without the dock. */
const onEarlier = () => useViewStore.getState().at !== null

/** Opening a chip selects its card, as clicking the card would, so everything that reads the selection names the card that is open. */
function selectCard(card: string | null): void {
  if (card === null) return
  const canvas = useCanvasStore.getState()
  if (canvas.nodes.some((n) => n.id === card)) canvas.selectNodeWithoutHistory(card)
}

/** Open one view in the dock (and, from a chip, the card it concerns and which of its chips: its ring is the one selection ring). */
export function openView(id: number, card: string | null = null, chip: string | null = null): void {
  if (onEarlier()) return
  noteLanded(chip ?? `view:${id}`, useUIStore.getState().activeOutputTab)
  useReveal.getState().select(id, card, chip)
  selectCard(card)
  useUIStore.getState().forceActivateOutputTab('team')
}

/** Open one piece of evidence in the dock (from a chip, with the card it sits on and that chip). */
export function openEvidence(id: number, card: string | null = null, chip: string | null = null): void {
  if (onEarlier()) return
  useReveal.getState().selectEvidence(id, card, chip)
  selectCard(card)
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
  const items = evidenceOffChips(evidenceOn(view, card), chipped)
  if (items.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`evidence-marks-${card}`}>
      {items.map((e) => {
        const on = open === e.id
        return (
          <button key={e.id} type="button" aria-pressed={on} aria-label={e.mark_label} title={e.mark_title} data-evidence-mark={e.id}
            onClick={(ev) => { ev.stopPropagation(); openEvidence(e.id) }}
            className={`pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header ${on ? `border-text-header ${SELECTED_RING}` : 'border-panel-border'}`}>
            <FileText aria-hidden="true" className="h-3 w-3" />
          </button>
        )
      })}
    </span>
  )
}

const initial = (by: string) => (Array.from(by)[0] ?? '').toUpperCase()
/** The chips' row: wide enough for two chips side by side. */
// J1 gate: a rail is as wide as its card and the room beside it, so two cards' rails side by side never overlap (they did at 380 px);
// a chip's words wrap inside it rather than run under its neighbour's. V11 pixel pass (9 Nov): exactly the card's width, so two
// neighbours' rails keep the board's gap between them (at + 16 they met, chip against chip, on the Reveal at 1232).
const CHIPS_WIDTH = CARD_WIDTH

/** What a mark says on hover and to a reader, in core's words: the person's figure mark (who, the figure, core's heading for its effect), or,
 *  for a view placed by its words, the person. */
const markWords = (m: Mark): string => m.figure?.mark_label ?? m.by

function useMarks(card: string) {
  const view = useViewStore((s) => s.view)
  const selected = useReveal((s) => s.selected)
  return { ...marksOn(revealOf(view), card), view, selected }
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
  const { initials, selected } = useMarks(card)
  if (initials.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`reveal-initials-${card}`}>
      {initials.map((m) => {
        const on = selected === m.view, words = markWords(m)
        return (
          <button key={`${m.view}`} type="button" aria-pressed={on} aria-label={words} title={words} data-reveal-initial={m.view} data-reveal-status={m.status ?? undefined}
            onClick={(e) => { e.stopPropagation(); openView(m.view) }}
            className={`pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border bg-canvas ${typography.viewLabel} text-text-body transition-colors duration-fast hover:border-text-header ${on ? `border-text-header ${SELECTED_RING}` : 'border-panel-border'}`}>
            {initial(m.by)}
          </button>
        )
      })}
    </span>
  )
}

/** Core's marks on this card's rail, just below it, out of flow, so no card moves; with them, the links the team's explanations differ on
 *  (TM-04, ../olumiCore/team/CardDiffers.tsx), in the same one rail. */
export function CardViewChips({ card }: { card: string }): JSX.Element | null {
  const { cardChips, view } = useMarks(card)
  const open = useReveal((s) => s)
  const openChip = openChipOf(revealOf(view), open)
  // The doubted links sit here unless the strategy chip is this card's only rail (then they sit in that one): never a second rail.
  // Core's link marks fold the served doubt chip (TM-04): a link core marks is drawn once, by its mark, never again as a difference here.
  const offLine = cardLinkMarksOf(view, card)
  const differs = unmarkedDiffers(view, useLinkDiffers(card)), hostsDiffers = cardChips.length > 0 || strategyMarkOn(view, card) === null
  const { wrap, style } = railLayout(hostsDiffers && differs.length > 0, CHIPS_WIDTH)
  // The link words keep clear of this rail's chips as of the card itself (railBoxes.ts).
  const railRef = useRailBoxesRef(`reveal:${card}`, card)
  const rail = (children: JSX.Element[]) => (
    // A rail of the reveal's chips alone (V11): centred under the card, side by side in ONE row inside the gap to the next row (a second
    // row would sit on the cards below); two chips may reach past the card's edges. The first (the difference that matters most) keeps all
    // its words; a later one gives way and ends in an ellipsis, its full words in its hover and its name. A rail that holds a doubted link
    // (TM-04) is the card's width instead and wraps to a second row, every chip at its natural width (railLayout).
    <div ref={railRef} className={`nodrag mt-1 flex flex-row ${wrap} justify-center gap-1.5`} style={style} data-testid={`reveal-chips-${card}`}>{children}</div>
  )
  if (cardChips.length > 0 || offLine.length > 0 || (hostsDiffers && differs.length > 0)) {
    return rail([...cardChips.map((chip, i) => {
      // No ring of its own when open: the card's ring is the one selection ring (approved v2.1); the open chip is raised.
      const on = openChip?.key === chip.key
      return (
        <button key={chip.key} type="button" aria-pressed={on} aria-label={chip.label} title={chip.title} data-reveal-card-chip={card} data-reveal-kind={chip.kind}
          data-reveal-chip={chip.kind === 'evidence' ? undefined : chip.views[0]} data-reveal-evidence-chip={chip.kind === 'evidence' ? chip.evidence[0] : undefined}
          onClick={(e) => { e.stopPropagation(); if (chip.kind === 'evidence') openEvidence(chip.evidence[0]!, card, chip.key); else openView(chip.views[0]!, card, chip.key) }}
          className={`pointer-events-auto inline-flex min-h-6 min-w-0 cursor-pointer items-center gap-1.5 rounded-[12px] border border-panel-border bg-panel py-0.5 pl-0.5 text-left ${i === 0 ? 'flex-1 pr-2.5' : 'flex-none pr-2'} ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${on ? 'shadow-2' : ''}`}>
          <People people={chip.people} />
          {i === 0
            // P1: core's words wrap in balanced lines, never one word alone on the last line ("…observed / it").
            ? <span className="min-w-0 [text-wrap:balance]" data-reveal-chip-text="">{chip.text}</span>
            : <>{chip.kind === 'evidence' ? <FileText aria-hidden="true" className="h-3 w-3 text-text-body" /> : chip.kind === 'disagreement' ? <GitFork aria-hidden="true" className="h-3 w-3 text-text-body" /> : <Users aria-hidden="true" className="h-3 w-3 text-text-body" />}
              <span className="sr-only" data-reveal-chip-text="">{chip.text}</span></>}
        </button>
      )
    }), ...offLine.map((m) => <LinkMarkCardChip key={`${m.link.record}|${m.link.part ?? ''}`} mark={m} />), ...(hostsDiffers ? differs.map((d) => <DifferChip key={d.record} d={d} card={card} />) : [])])
  }
  return null
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
