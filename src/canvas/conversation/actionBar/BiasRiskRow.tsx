import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { ACTION_FOCUS } from '../../../components/results/analysisNew/panelSurfaces'
import type { ActionBarRevision } from './actionBarContract'
import type { BiasRiskView } from './biasRiskContract'
import { pressOffer } from './pressOffer'

export const BIAS_RISK_COPY = {
  lead: 'Check for:',
  claim: (title: string, strength: string) => `Decision-science claim: ${title} · ${strength} evidence`,
} as const

interface BiasRiskRowProps {
  view: BiasRiskView
  revision: ActionBarRevision
  type: { body: string; meta: string }
}

export function BiasRiskRow({ view, revision, type }: BiasRiskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div data-testid="bias-risk-row" className="mt-1 min-w-0">
      <button
        type="button"
        aria-expanded={expanded}
        data-testid="bias-risk-toggle"
        onClick={() => setExpanded((current) => !current)}
        className={`flex w-full min-w-0 items-center gap-1 text-left ${type.body} text-text-body ${ACTION_FOCUS}`}
      >
        <span className="min-w-0">{BIAS_RISK_COPY.lead} {view.items.map((item) => item.name).join(' · ')}</span>
        <Chevron className="size-4 shrink-0 text-text-light" aria-hidden={true} />
      </button>
      {expanded ? view.items.map((item) => (
        <div key={item.claim_id} data-testid={`bias-risk-item-${item.claim_id}`} className="mt-2 pl-5">
          <p className={`${type.body} text-text-body`}>{item.why}</p>
          {item.science ? <p className={`${type.meta} text-text-light`}>{BIAS_RISK_COPY.claim(item.science.claim_title, item.science.evidence_strength)}</p> : null}
          <button
            type="button"
            data-testid={`bias-risk-press-${item.claim_id}`}
            onClick={() => pressOffer(item.offer, revision)}
            className={`${type.body} mt-1 text-text-body underline ${ACTION_FOCUS}`}
          >
            {item.offer.label}
          </button>
        </div>
      )) : null}
    </div>
  )
}
