/**
 * The crafted goal-chance range lines (`components/results/analysis-hero/GoalChanceRangeLines.tsx`), ported onto olumi.view/3: under each
 * option, the links on its own path that core sizes (`links[].effect`: from the option, or from the lever card it sets), each line core's
 * words for the size (`effect.text`) with core's whole sentence on hover (`effect.title`), under the heading of the card it is about (the
 * figure, `effect.figure`, when the canvas draws it; else the lever card the link leaves). The crafted line's own
 * action words ("Size it to see where it lands") are not ported: with `onOpenLink` the line itself opens that link, named by core's hover.
 * Nothing is composed and nothing is drawn when core sizes no link.
 */
import type { ViewModel } from '../client'
import { cardOf, optionEffectsOf } from './pick'
import { TYPE } from './type'

export interface GoalChanceRangeLinesProps {
  model: ViewModel
  /** Opens one link where the caller shows links (its two ends, exactly as the View gives them). Absent: the lines are text only. */
  onOpenLink?: (from: string, to: string) => void
}

export function GoalChanceRangeLines({ model, onOpenLink }: GoalChanceRangeLinesProps) {
  const groups = optionEffectsOf(model)
  if (groups.length === 0) return null
  return (
    <div data-testid="port-range-lines" className={`flex flex-col gap-2 py-2 ${TYPE.body}`}>
      {groups.map(({ card, links }) => (
        <div key={card.id} data-testid="port-range-option" data-option-id={card.id} className="space-y-0.5">
          <p className="font-medium text-text-header" data-view={`${card.id}.heading`}>{card.heading}</p>
          {links.map(({ link, i }) => {
            const figure = cardOf(model, link.effect!.figure) ?? (link.from === card.id ? null : cardOf(model, link.from))
            const words = (
              <>
                {figure === null ? null : <span className={`${TYPE.meta} block text-text-light`} data-view={`${figure.id}.heading`}>{figure.heading}</span>}
                <span className="block text-text-body" data-view={`links.${i}.effect.text`}>{link.effect!.text}</span>
              </>
            )
            return onOpenLink === undefined
              ? <p key={i} data-testid="port-range-line" data-link={`${link.from}->${link.to}`} title={link.effect!.title}>{words}</p>
              : (
                <button key={i} type="button" data-testid="port-range-line" data-link={`${link.from}->${link.to}`} title={link.effect!.title} aria-label={link.effect!.title}
                  onClick={() => onOpenLink(link.from, link.to)}
                  className="block w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info">
                  {words}
                </button>
              )
          })}
        </div>
      ))}
    </div>
  )
}

export default GoalChanceRangeLines
