/**
 * The one finding line (experience review 18 Nov, change 1): core's `model.run.finding`, drawn verbatim where the eye lands, on the question card
 * and at the top of the Olumi panel. It says what the CURRENT MODEL implies and what it turns on, never what to choose. The figure it moves most with
 * is one press away (the card on the canvas, selected and centred); `needs` is a second, quieter line. Absent or null in the View: nothing drawn.
 */
import type { ViewModel } from './client'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { findingOf } from './v12/contract'
import { recordReach, showRecord } from './v12/showInWorkspace/show'
import { typography } from '../styles/typography'

const RING = 'finding'

export function FindingLine({ model, at }: { model: ViewModel | null | undefined; at: 'question' | 'panel' }): JSX.Element | null {
  const f = findingOf(model)
  if (f === null) return null
  const card = f.figure === null ? null : model?.cards.find((c) => c.id === f.figure) ?? null
  // A figure folded behind a badge, a group or Simple's inputs is opened and shown (the reply's own show path); a drawn card is pressed.
  return (
    <div className="grid min-w-0 gap-0.5" data-finding={at}>
      <p className={`${at === 'question' ? typography.viewLabel : typography.viewPanelBody} m-0 line-clamp-2 break-words text-text-body`} title={f.title} data-view="run.finding">{f.text}</p>
      {card === null ? null
        : <button type="button" className={`${typography.viewLabel} nodrag m-0 w-fit max-w-full truncate rounded-sm p-0 text-left text-text-light underline-offset-2 hover:underline`} title={card.heading} onClick={() => { if (recordReach(card.id) === 'show') void showRecord(card.id); else pressCard(card.id) }}
            onMouseEnter={() => ringFrom(RING, [card.id])} onFocus={() => ringFrom(RING, [card.id])} onBlur={() => ringFrom(RING, [])} onMouseLeave={() => ringFrom(RING, [])} data-finding-figure={card.id}>{card.heading}</button>}
      {f.needs === null ? null : <p className={`${typography.viewLabel} m-0 line-clamp-2 break-words text-text-light`} data-view="run.finding.needs">{f.needs}</p>}
    </div>
  )
}
