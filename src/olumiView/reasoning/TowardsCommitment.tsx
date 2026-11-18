/**
 * Towards commitment (Reasoning redesign 2, Paul 18 Nov: "yes", Reasoning holds the move from uncertainty to commitment). The tab's last
 * section, and the thinking's end: what is still disputed, what the team has already recorded it will do, and one press that opens the ONE
 * commitment form (`openCommitDraft`: the shared draft the chat and the Team tab already write through `teamApi.addCommitment`). No second
 * form, no second write. Every word is the team's or core's (`collab.dissent`, `collab.commitments`); Olumi writes none of the answers, and
 * the form records what the PEOPLE will do, never an option Olumi picks.
 */
import type { View, ViewModel } from '../client'
import { challengedCards } from '../layout'
import { pressCard } from './tabRing'
import { OkIcon } from '../look/icons'
import { isForThisPage, useMe } from '../../olumiCore/me'
import { useViewStore } from '../store'
import { COMMIT_WORDS, openCommitDraft } from '../v12/team/CommitForm'
import { TYPE } from '../port/type'
import { typography } from '../../styles/typography'

/** The section's chrome. */
export const COMMITMENT_WORDS = {
  heading: 'Towards commitment',
  open: 'Disagreements still open',
  recorded: 'Recorded',
  reconsider: 'Reconsider if',
  review: 'Review on',
} as const

const H = `${typography.viewPanelHeading} m-0 text-text-header`
const SUB = `${TYPE.meta} m-0 text-text-light`
const BUTTON = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full border border-success bg-success px-3 text-text-header hover:border-success-hover hover:bg-success-hover active:bg-success-active focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`

export function TowardsCommitment({ view, model }: { view: View; model: ViewModel }) {
  const sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at), me = useMe((s) => s.me)
  const c = view.collab, commitments = view.collab.commitments ?? []
  // The form is offered only where it may be written: this page's own View, the latest version, for the person it is for.
  const reach = sid && at === null && isForThisPage(view, me) ? sid : null
  const dissent = (c.dissent ?? []).filter((d) => (d.confirmed?.words ?? d.position) !== '')
  // A disagreement whose card the tab already lists as challenged is said there; here it is named by its holder, one press to its card.
  const above = new Set(challengedCards(model).map((x) => x.id))
  if (reach === null && dissent.length + commitments.length === 0) return null
  return (
    <section className="space-y-2" data-testid="reasoning-commitment" aria-label={COMMITMENT_WORDS.heading}>
      <h3 className={H}>{COMMITMENT_WORDS.heading}</h3>
      {dissent.length === 0 ? null : (
        <div className="space-y-1" data-testid="reasoning-commitment-dissent">
          <p className={SUB}>{COMMITMENT_WORDS.open}</p>
          <ul className="m-0 list-none space-y-1 p-0">
            {dissent.map((d) => {
              const words = d.confirmed?.words ?? d.position
              if (above.has(d.id) && d.holder !== '') return (
                <li key={d.id} data-dissent={d.id} data-dissent-said="above">
                  <button type="button" onClick={() => pressCard(d.id)} title={words} className={`${TYPE.body} flex min-h-7 w-full items-center gap-2 rounded-sm px-1 text-left text-text-header hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}>
                    <OkIcon id="challenged" size={14} decorative /><span className="min-w-0 flex-1 break-words">{d.holder}</span>
                  </button>
                </li>
              )
              return (
                <li key={d.id} className={`${TYPE.body} flex items-start gap-2 px-1 text-text-body`} data-dissent={d.id}>
                  <OkIcon id="challenged" size={14} className="mt-0.5" decorative />
                  <span className="min-w-0 flex-1 break-words">{d.holder === '' ? null : <span className="text-text-header">{d.holder}: </span>}{words}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {commitments.length === 0 ? null : (
        <div className="space-y-1" data-testid="reasoning-commitment-recorded">
          <p className={SUB}>{COMMITMENT_WORDS.recorded}</p>
          <ul className="m-0 list-none space-y-2 p-0">
            {commitments.map((k) => (
              <li key={k.id} className="flex items-start gap-2 px-1" data-commitment={k.id}>
                <OkIcon id="commit-action" size={14} className="mt-0.5" decorative />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className={`${TYPE.body} block whitespace-pre-wrap break-words text-text-header`}>{k.action}</span>
                  {k.option == null ? null : <span className={`${TYPE.meta} block break-words text-text-light`} data-commitment-option={k.id}>{k.option.heading}</span>}
                  {(k.reconsider ?? '') === '' ? null : <span className={`${TYPE.meta} block break-words text-text-body`} data-commitment-reconsider={k.id}>{COMMITMENT_WORDS.reconsider}: {k.reconsider}</span>}
                  {k.review_on == null ? null : <span className={`${TYPE.meta} block text-text-light`} data-commitment-review={k.id}>{COMMITMENT_WORDS.review} {k.review_on}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {reach === null ? null : (
        <button type="button" className={BUTTON} onClick={() => openCommitDraft(reach, view)} data-testid="reasoning-commit-open">
          <OkIcon id="commit-action" size={14} decorative />{COMMIT_WORDS.heading}
        </button>
      )}
    </section>
  )
}
