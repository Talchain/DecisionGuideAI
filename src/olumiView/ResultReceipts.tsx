import type { ViewTurn } from './client'
import { typography } from '../styles/typography'

type Claims = NonNullable<ViewTurn['answer']>['claims']
type AssumptionValue = NonNullable<Claims>[number]['assumptions'][number]['value']

function assumptionWords(value: AssumptionValue): string {
  if ('point' in value) return (value.approximate ? 'about ' : '') + value.point
  if ('low' in value) return value.low + ' to ' + value.high + (value.likely == null ? '' : ' (most likely ' + value.likely + ')')
  if ('asked' in value) return value.asked
  if ('unknown' in value) return value.unknown
  return 'Calculated by the model'
}

const statuses = { saved: 'Saved model', proposed: 'Proposed model', 'what-if': 'What-if' } as const

/** The heading of the receipts, in the reply's one facts disclosure (ReplyFacts); it was the fold's summary. */
export const RESULTS_REST_ON = 'What these results rest on'

/** Whether the reply has receipts to draw. */
export const hasReceipts = (claims: Claims): boolean => (claims?.length ?? 0) > 0

/** The details belong to the answer that used the figure, including after another version is saved. Drawn inside ReplyFacts' disclosure (P4): the list only. */
export function ResultReceipts({ claims }: { claims: Claims }) {
  if (!claims?.length) return null
  return <div className="text-text-body">
    <ul className="list-none ok-stack">
      {claims.map((claim, i) => <li key={claim.cite + '/' + i} className="space-y-1">
        {/* The option's name at the scale's 500 weight (Paul, 7 Nov: 400/500 only; a bare <strong> drew 700). */}
        <p><strong className="font-medium">{claim.optionName}</strong> · {claim.aimName} · {claim.figure}</p>
        <p className={typography.chatMeta}>{statuses[claim.status]} · {claim.status === 'saved' ? 'Version ' + claim.version : claim.version === 0 ? 'Before first approval' : 'Based on version ' + claim.version}{claim.superseded ? ' · Before the changes in this reply' : ''}</p>
        {claim.basis && <p>{claim.basis}</p>}
        {claim.conditions && <p>{claim.conditions}</p>}
        {claim.assumptions.length > 0 && <ul className="list-disc pl-5">
          {claim.assumptions.map(a => <li key={a.figure}>{a.label} · {assumptionWords(a.value)}{('low' in a.value || 'point' in a.value) && a.unit && a.unit !== '1' ? ' ' + a.unit : ''}</li>)}
        </ul>}
      </li>)}
    </ul>
  </div>
}
