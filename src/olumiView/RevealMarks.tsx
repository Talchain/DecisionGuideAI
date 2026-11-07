/**
 * V11: the revealed views drawn on the card they are about (./reveal.ts says where and which). On the card, the people whose view sits there
 * as initials in its marks row; below it, on its outgoing link, the consequential disagreement as a chip. Selecting either opens that view
 * in the dock (the Team tab). Every word is core's: the person's name, their figure's label and text, core's heading for the effect.
 */
import { GitFork } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { CARD_WIDTH } from './layout'
import { marksOn, revealOf, useReveal, type Mark } from './reveal'

/** Open one view in the dock. */
export function openView(id: number): void {
  useReveal.getState().select(id)
  useUIStore.getState().forceActivateOutputTab('team')
}

const initial = (by: string) => by.slice(0, 1).toUpperCase()

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

/** The people whose view sits on this card, as initials in its marks row. */
export function CardViewInitials({ card }: { card: string }): JSX.Element | null {
  const { initials, selected, heading } = useMarks(card)
  if (initials.length === 0) return null
  return (
    <span className="nodrag inline-flex gap-1" data-testid={`reveal-initials-${card}`}>
      {initials.map((m) => {
        const on = selected === m.view
        return (
          <button key={`${m.view}`} type="button" aria-pressed={on} aria-label={markWords(m, heading(m))} title={markWords(m, heading(m))}
            data-reveal-initial={m.view} data-reveal-status={m.status ?? undefined}
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
  const { chips, selected, heading } = useMarks(card)
  if (chips.length === 0) return null
  return (
    // Centred under the card, on its outgoing links, inside the gap to the next row (out of flow: no card moves).
    <div className="nodrag mt-1 flex flex-col items-center gap-1" style={{ width: CARD_WIDTH }} data-testid={`reveal-chips-${card}`}>
      {chips.map((m) => {
        const on = selected === m.view
        return (
          <button key={`${m.view}:${m.figure?.quantity ?? ''}`} type="button" aria-pressed={on} aria-label={markWords(m, heading(m))} title={markWords(m, heading(m))}
            data-reveal-chip={m.view} data-reveal-status={m.status ?? undefined}
            onClick={(e) => { e.stopPropagation(); openView(m.view) }}
            className={`pointer-events-auto inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border bg-panel pl-0.5 pr-2.5 ${typography.viewLabel} text-text-header shadow-1 transition-shadow duration-fast hover:shadow-2 ${on ? 'border-text-header ring-1 ring-text-header' : 'border-text-header'}`}>
            <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">{initial(m.by)}</span>
            <GitFork aria-hidden="true" className="h-3 w-3 flex-none text-text-body" />
            {/* Core's label for it when core sends one; until then the person and their figure, in core's words. */}
            <span className="truncate">{m.chip ?? (m.figure === null ? m.by : `${m.by}: ${m.figure.text}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
