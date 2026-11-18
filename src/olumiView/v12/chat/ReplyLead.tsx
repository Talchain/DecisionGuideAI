import type { ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import type { ReplyLead as Lead } from '../../early'
import { richText } from './richText'

/** The one disclosure a reply's full answer sits under (DL 11:06:45Z, Paul 11:02Z): page chrome, the only words here that are not core's. */
export const FULL_ANSWER = 'Full answer'

/**
 * A reply's short lead, then its full answer folded beneath, closed at rest (Paul 11:02Z: "stop fighting reply length with wording"). The lead is
 * core's (`lead.opening`, `lead.points`), drawn verbatim; the full answer is whatever the caller draws today, unchanged. Nothing is cut, counted or
 * written here. `big`: the newest reply's short opening is the panel's one 18 px line (the caller decides, as for any reply's opening).
 */
export function ReplyLead({ lead, at, big = false, keep, children }: { lead: Lead; at: string; big?: boolean; /** One visible Keep chooser beside the lead (the floor reply's core-offered entries), drawn outside the fold. */ keep?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="space-y-2" data-testid="view-reply-lead">
        <p className={big ? `group/item m-0 ${typography.viewPanelHeadline} text-text-header` : 'group/item m-0 text-text-header'} data-view={`${at}.lead.opening`} data-reply-opening="">{richText(lead.opening)}</p>
        {lead.points.length === 0 ? null : (
          <ul className="m-0 !list-none !pl-3" data-reply-list="" data-testid="view-reply-lead-points">
            {lead.points.map((p, i) => <li key={i} className="group/item relative !mb-1 last:!mb-0 before:absolute before:-left-3 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:!bg-text-light before:content-['']" data-view={`${at}.lead.points.${i}`}>{richText(p)}</li>)}
          </ul>
        )}
        {keep}
      </div>
      <details className="ok-reply-more" data-testid="view-reply-full">
        <summary>{FULL_ANSWER}</summary>
        <div className="space-y-2" data-testid="view-reply-full-body">{children}</div>
      </details>
    </>
  )
}
