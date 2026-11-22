import type { ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import type { LeadAction, ReplyLead as Lead } from '../../early'
import { richText } from './richText'
import { useViewStore } from '../../store'
import { recordReach, showRecord } from '../showInWorkspace/show'
import { pressCard } from '../../reasoning/tabRing'
import { OkIcon } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'

/** The one disclosure a reply's full answer sits under (DL 11:06:45Z, Paul 11:02Z): page chrome, the only words here that are not core's. */
export const FULL_ANSWER = 'Full answer'

/** The words of the mark a world action carries (an action about what is outside the model): Olumi's own general contribution, never a claim from the model. */

/**
 * One of the lead's actions, core's words on one line. On a record or a finding the line is a button that reaches that card as every other press
 * from the chat does (a card the board draws is selected; one behind a fold or badge is shown); on the world it is words with Olumi's mark and no link.
 * On a linked line the basis is the one Tip on the words; on a world line it is a quiet line under them, at rest.
 */
function ActionLine({ a, at }: { a: LeadAction; at: string }) {
  const model = useViewStore((st) => st.view?.model ?? null)
  const on = a.on
  if ('world' in on) {
    // Olumi's own suggestion is marked as Olumi's where it is read (DL 20 Nov, slice-3 proof: the mark alone did not say it): core's basis is a quiet line under
    // the words, said once at rest, so the mark beside it is decorative and the words carry no Tip repeating it.
    return (
      <li className="ok-lead-action" data-lead-action="world">
        <OkIcon id="olumi-contributes" size={14} decorative /><span className="ok-lead-action-words" data-view={`${at}.text`}>{a.text}</span>
        <p className={`${typography.viewPanelMeta} text-text-light m-0 ok-lead-action-basis`} data-view={`${at}.basis`}>{a.basis}</p>
      </li>
    )
  }
  // A finding is reached through the card it rests on, as the finding line's own figure link does; one whose id matches no card is words alone with the basis Tip (never another finding's figure).
  const named = 'record' in on ? on.record : on.finding
  const id = 'record' in on || model?.cards.some((c) => c.id === named) === true ? named : null
  if (id === null) return <li className="ok-lead-action" data-lead-action="plain"><Hover words={a.basis} className="ok-lead-action-words" data-view={`${at}.text`}>{a.text}</Hover></li>
  const words = <span className="ok-lead-action-words" data-view={`${at}.text`}>{a.text}</span>
  return (
    <li className="ok-lead-action" data-lead-action="card">
      <HoverButton words={a.basis} type="button" className="ok-lead-action-link nodrag" data-lead-action-card={id}
        onClick={() => { if (recordReach(id) === 'show') void showRecord(id); else pressCard(id) }}>{words}</HoverButton>
    </li>
  )
}

/**
 * A reply's short lead, then its full answer folded beneath, closed at rest (Paul 11:02Z: "stop fighting reply length with wording"). The lead is
 * core's (`lead.opening`, then `lead.points`, then `lead.actions` when core sends any; Paul's reply shape: a sentence or two, then the bullets; DL ruling 20 Nov after Codex), drawn verbatim; the full answer is whatever the caller draws today, unchanged. Nothing is cut, counted or
 * written here. `big`: the newest reply's short opening is the panel's one 18 px line (the caller decides, as for any reply's opening).
 */
export function ReplyLead({ lead, at, big = false, keep, children }: { lead: Lead; at: string; big?: boolean; /** One visible Keep chooser beside the lead (the floor reply's core-offered entries), drawn outside the fold. */ keep?: ReactNode; /** Absent or null: there is nothing to fold, so no "Full answer" is drawn. */ children?: ReactNode }) {
  return (
    <>
      <div className="space-y-3" data-testid="view-reply-lead">
        <p className={big ? `group/item m-0 ${typography.viewPanelHeadline} text-text-header` : 'group/item m-0 text-text-header'} data-view={`${at}.lead.opening`} data-reply-opening="">{richText(lead.opening)}</p>
        {lead.points.length === 0 ? null : (
          <ul className="m-0 !list-none !pl-3" data-reply-list="" data-testid="view-reply-lead-points">
            {lead.points.map((p, i) => <li key={i} className="group/item relative !mb-1 last:!mb-0 before:absolute before:-left-3 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:!bg-text-light before:content-['']" data-view={`${at}.lead.points.${i}`}>{richText(p)}</li>)}
          </ul>
        )}
        {lead.actions === undefined || lead.actions.length === 0 ? null : (
          <ul className="m-0 list-none space-y-3 p-0" data-testid="view-reply-lead-actions">
            {lead.actions.map((a, i) => <ActionLine key={i} a={a} at={`${at}.lead.actions.${i}`} />)}
          </ul>
        )}
        {/* K1 (core c918fe31): what the reply mentions that the model does not hold, one quiet line after the actions, core's words verbatim (never a point). */}
        {lead.not_held === undefined ? null : <p className={`${typography.viewPanelMeta} m-0 text-text-light`} data-testid="view-lead-not-held" data-view={`${at}.lead.not_held`}>{lead.not_held}</p>}
        {keep}
      </div>
      {children == null ? null : (
        <details className="ok-reply-more" data-testid="view-reply-full">
          <summary>{FULL_ANSWER}</summary>
          <div className="space-y-3" data-testid="view-reply-full-body">{children}</div>
        </details>
      )}
    </>
  )
}
