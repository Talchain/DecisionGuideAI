/**
 * WHAT A WAITING TOTAL IS MADE OF, AT REST (workstream 3, 16 Nov). A figure worked out from others that cannot be worked out yet used to
 * show one clipped line ("waits on: A, B, C") and keep its parts behind a press. Its parts ARE what the person can act on, so the Simple
 * face lists them: core's own working (`card.worked`), one line per operand in core's order, the joining word read from the form and the
 * step's own sign or power (look/WorkedSteps joinOf), core's words for the operand's figure ("not sized yet"), Olumi's mark where the
 * operand is Olumi's, and its edit where core offers one. An operand that is a card on the canvas is named only: its own card says the
 * rest. Nothing is worked out, reworded or reordered here, and no number is shown where core sends none.
 */
import type { ViewCard } from '../../client'
import { typography } from '../../../styles/typography'
import { FigureEdit } from '../../FigureEdit'
import { joinOf } from '../../look/WorkedSteps'
import { OlumiMark } from './marks'

export const GIVE_FIGURE = 'Give this figure'

export function MadeOf({ card, drawn }: { card: ViewCard; drawn: (id: string) => boolean }): JSX.Element | null {
  const worked = card.worked
  if (worked == null || worked.steps.length === 0) return null
  return (
    <ol className="nodrag m-0 grid min-w-0 list-none gap-1 p-0" data-made-of={card.id} data-worked-form={worked.form}>
      {worked.steps.map((s, i) => {
        const join = joinOf(worked.form, s, i === 0), onCanvas = drawn(s.id)
        return (
          <li key={`${s.id}:${i}`} title={s.figure.title !== '' ? s.figure.title : undefined} className={`${typography.viewLabel} flex min-w-0 flex-wrap items-baseline gap-1 text-text-body`}
            data-made-of-step={s.id} data-step-sign={s.sign} data-step-power={s.power}>
            {join === null ? null : <span className="flex-none font-medium text-text-header" data-step-join={join}>{join}</span>}
            <span className="line-clamp-2 min-w-0 flex-1 break-words">{s.label}</span>
            {onCanvas ? null : <span className="flex-none text-text-light" data-made-of-figure={s.id}>{s.figure.text}</span>}
            {onCanvas || s.author?.by !== 'olumi' ? null : <span className="flex-none self-center"><OlumiMark words={s.author.title} size={12} /></span>}
            {onCanvas || s.edit == null ? null : <span className="ok-edit flex-none" data-figure-edit-wrap=""><FigureEdit id={s.id} edit={s.edit} place="view-step" glyph label={GIVE_FIGURE} words={false} /></span>}
            {/* An effect's term is its driver times its own coefficient (core's `coefficient` operand): named beside it, never dropped. */}
            {worked.form !== 'effect' || s.coefficient == null ? null : (
              <span className="flex min-w-0 basis-full items-baseline gap-1 pl-3" data-made-of-coefficient={s.coefficient.id}>
                <span className="flex-none font-medium text-text-header" data-step-join="times">times</span>
                <span className="line-clamp-2 min-w-0 flex-1 break-words">{s.coefficient.label}</span>
                <span className="flex-none text-text-light">{s.coefficient.figure.text}</span>
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
