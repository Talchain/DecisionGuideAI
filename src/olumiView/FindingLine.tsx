/**
 * The one finding line (experience review 18 Nov, change 1): core's `model.run.finding`, drawn verbatim where the eye lands, on the question card
 * and at the top of the Olumi panel. It says what the CURRENT MODEL implies and what it turns on, never what to choose. The figure it moves most with
 * is one press away (the card on the canvas, selected and centred); `needs` is a second, quieter line. Absent or null in the View: nothing drawn.
 */
import type { ViewModel } from './client'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { findingOf, hasAnyResult, panelDrawsFinding } from './v12/contract'
import { recordReach, showRecord } from './v12/showInWorkspace/show'
import { typography } from '../styles/typography'
import { OkIcon } from './look/icons'

const RING = 'finding'
/** The pressable figure's own name, said by the same mark Analysis uses for it: a bare card name under the finding read as an orphan (roll5 pictures). */
export const FINDING_FIGURE = 'The figure this moves most with'

export function FindingLine({ model, at }: { model: ViewModel | null | undefined; at: 'question' | 'panel' }): JSX.Element | null {
  const f = findingOf(model)
  if (f === null) return null
  // Said once (S4, 19 Nov: "nothing is said twice"): where the panel draws the finding (sentence, figure, needs), the question card shows the person's question, not this.
  if (at === 'question' && panelDrawsFinding(model)) return null
  const card = f.figure === null ? null : model?.cards.find((c) => c.id === f.figure) ?? null
  // Said once (Paul 19 Nov: "cannot be worked out" three times): with no calculated result on any option the finding is a status the aim card already says
  // ("needs a target", "No chance yet"), so the question card does not draw its sentence; the figure and the needs line stay. Read by field (`hasAnyResult`), never by words.
  const sentence = at === 'panel' || hasAnyResult(model)
  if (!sentence && card === null && f.needs === null) return null
  // A figure folded behind a badge, a group or Simple's inputs is opened and shown (the reply's own show path); a drawn card is pressed.
  return (
    <div className="grid min-w-0 gap-0.5" data-finding={at}>
      {sentence ? <p className={`${at === 'question' ? typography.viewLabel : typography.viewPanelBody} m-0 line-clamp-2 break-words text-text-body`} title={f.title} data-view="run.finding">{f.text}</p> : null}
      {card === null ? null
        : <button type="button" className={`${typography.viewLabel} nodrag m-0 flex w-fit max-w-full items-center gap-1 rounded-sm p-0 text-left text-text-light underline-offset-2 hover:underline`} title={`${FINDING_FIGURE}: ${card.heading}`} aria-label={`${FINDING_FIGURE}: ${card.heading}`} onClick={() => { if (recordReach(card.id) === 'show') void showRecord(card.id); else pressCard(card.id) }}
            onMouseEnter={() => ringFrom(RING, [card.id])} onFocus={() => ringFrom(RING, [card.id])} onBlur={() => ringFrom(RING, [])} onMouseLeave={() => ringFrom(RING, [])} data-finding-figure={card.id}><OkIcon id="why-moves" size={14} inherit decorative /><span className="min-w-0 truncate">{card.heading}</span></button>}
      {f.needs === null ? null : <p className={`${typography.viewLabel} m-0 line-clamp-2 break-words text-text-light`} data-view="run.finding.needs">{f.needs}</p>}
    </div>
  )
}
