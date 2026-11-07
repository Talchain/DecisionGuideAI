/**
 * The crafted factor insights disclosure (`components/results/FactorInsights.tsx`), ported onto olumi.view/3: the same "Insights" toggle,
 * closed at first, with independent sub-lists. Its content is core's words about one card: the card's reason (`reason`) and its premises
 * (`premises[]`), grouped by core's mark for each, under core's key word for that mark (e.g. "assumption", "prerequisite", "challenge");
 * each premise's full sentence on hover. Core holds no AI observations, perspectives or confidence question (core-port-fields, 7 Nov), so
 * those lists are not drawn. Nothing when the card has neither a reason nor a premise.
 */
import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ViewCard, ViewModel } from '../client'
import { premiseGroupsOf } from './pick'
import { TYPE } from './type'

export interface FactorInsightsProps {
  model: ViewModel
  card: ViewCard
  defaultOpen?: boolean
}

export function FactorInsights({ model, card, defaultOpen = false }: FactorInsightsProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const groups = premiseGroupsOf(model, card)
  const reason = card.reason != null && card.reason !== '' && card.reason !== card.heading ? card.reason : null
  if (groups.length === 0 && reason === null) return null
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <div className="mt-2 pt-2" data-testid="port-factor-insights" data-card={card.id}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={contentId} data-testid="port-factor-insights-toggle"
        className={`flex w-full items-center gap-1 text-left text-text-light transition-colors hover:text-text-body ${TYPE.body}`}>
        <Chevron size={14} className="shrink-0" aria-hidden="true" />
        <span>Insights</span>
      </button>
      {!open ? null : (
        <div id={contentId} className={`mt-2 space-y-3 text-text-body ${TYPE.body}`}>
          {reason === null ? null : <p className="leading-relaxed" data-view={`${card.id}.reason`}>{reason}</p>}
          {groups.map((g) => (
            <div key={g.glyph} data-testid="port-factor-premises" data-glyph={g.glyph}>
              {g.key === null ? null : <div className={`${TYPE.meta} mb-1 text-text-light`} data-view={`key.${g.key.i}.text`}>{g.key.text}</div>}
              <ul className="space-y-0.5 pl-1">
                {g.items.map(({ p, j }) => (
                  <li key={j} className="flex gap-1.5 leading-relaxed" title={p.title}>
                    <span aria-hidden="true" className="shrink-0" data-view={`${card.id}.premises.${j}.glyph`}>{p.glyph}</span>
                    <span data-view={`${card.id}.premises.${j}.text`}>{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FactorInsights
