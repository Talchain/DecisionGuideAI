/**
 * The one finding line (experience review 18 Nov, change 1): core's `model.run.finding`, drawn verbatim where the eye lands, on the question card
 * and at the top of the Olumi panel. It says what the CURRENT MODEL implies and what it turns on, never what to choose. The figure it moves most with
 * is one press away on the canvas; `needs` is a second, quieter line. Absent or null in the View: nothing drawn.
 */
import { flushSync } from 'react-dom'
import type { ViewModel } from './client'
import { newestLeadDrawn } from './early'
import { useViewStore } from './store'
import { pressCard, ringFrom } from './reasoning/tabRing'
import { findingOf, hasAnyResult } from './v12/contract'
import { useFrameStage } from './v12/frame/useFrameStage'
import { recordReach, showRecord } from './v12/showInWorkspace/show'
import { typography } from '../styles/typography'
import { OkIcon } from './look/icons'
import { useAnchoredTip } from './look/Tip'
import { Hover } from './look/Hover'

const RING = 'finding'
/** The pressable figure's own name, said by the same mark Analysis uses for it: a bare card name under the finding read as an orphan (roll5 pictures). */
export const FINDING_FIGURE = 'The figure this moves most with'

export function FindingLine({ model, at }: { model: ViewModel | null | undefined; at: 'question' | 'frame' | 'panel' }): JSX.Element | null {
  const f = findingOf(model)
  const latestOpening = useViewStore((s) => at === 'question' && f !== null
    ? newestLeadDrawn(s.view, { includeFloor: true })?.opening
    : undefined)
  const card = f === null || f.figure === null ? null : model?.cards.find((c) => c.id === f.figure) ?? null
  // The pressable figure's hover is the one Tip (pointer after 150 ms, and keyboard focus); the ring below rides the same focus and blur.
  const figureWords = card === null ? undefined : `${FINDING_FIGURE}: ${card.heading}`
  const figure = useAnchoredTip(figureWords)
  if (f === null) return null
  // Said once (Paul 19 Nov: "cannot be worked out" three times): with no calculated result on any option the finding is a status the aim card already says
  // ("needs a target", "No chance yet"), so the question card does not draw its sentence; the figure and the needs line stay. Read by field (`hasAnyResult`), never by words.
  // On the question card, a byte-identical reply opening also replaces the sentence.
  const sentence = at !== 'question' || (hasAnyResult(model) && f.text !== latestOpening)
  if (!sentence && card === null && f.needs === null) return null
  return (
    <div className="grid min-w-0 gap-0.5" data-finding={at}>
      {sentence ? <Hover as="p" words={f.title} className={`${at === 'question' ? typography.viewLabel : typography.viewPanelBody} m-0 break-words text-text-body`} data-view="run.finding">{f.text}</Hover> : null}
      {card === null ? null
        : <>
          <button type="button" className={`${typography.viewLabel} nodrag m-0 flex w-fit max-w-full items-center gap-1 rounded-sm p-0 text-left text-text-light underline-offset-2 hover:underline`} aria-label={figureWords} aria-describedby={figure.describedBy}
            onClick={() => {
              const reach = recordReach(card.id)
              if (at !== 'question' && reach === null) return
              figure.dismiss()
              if (at !== 'question') {
                const frame = useFrameStage.getState()
                if (frame.open) flushSync(frame.hide)
                void showRecord(card.id)
              } else if (reach === 'show') void showRecord(card.id)
              else pressCard(card.id)
            }}
            {...figure.handlers} onMouseEnter={() => ringFrom(RING, [card.id])} onMouseLeave={() => ringFrom(RING, [])}
            onFocus={(e) => { figure.handlers.onFocus(e); ringFrom(RING, [card.id]) }} onBlur={() => { figure.handlers.onBlur(); ringFrom(RING, []) }} data-finding-figure={card.id}>
            <OkIcon id="why-moves" size={14} inherit decorative /><span className="min-w-0 break-words">{card.heading}</span>
            {at === 'question' ? null : <OkIcon id="show-in-workspace" size={14} inherit decorative />}
          </button>
          {figure.tip}
        </>}
      {f.needs === null ? null : <p className={`${typography.viewLabel} m-0 break-words text-text-light`} data-view="run.finding.needs">{f.needs}</p>}
    </div>
  )
}
