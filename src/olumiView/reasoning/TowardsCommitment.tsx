/**
 * Towards commitment (Reasoning, Paul 18 Nov: Reasoning holds the move from uncertainty to commitment; reworked after the Codex critique,
 * overnight/analysis/REASONING-CRITIQUE.md). The tab's last section, in three parts, then one press:
 *   - Where your views differ: core's own differences between revealed views (`useRevealedDifferences`, the Team tab's read and gate: nothing
 *     before the reveal, while gated or on an earlier version). A figure difference is the card (one press to it) and the Team tab's own
 *     `WhereYouDiffer` under it (core's sentence, each person's figure and chance, what would settle it); a link or factor, core's sentence;
 *   - Disagreements still open: each recorded dissent IN FULL, in its holder's words (a challenged card that is a dissent is said here, not in
 *     the list above, so it is said once);
 *   - Recorded: each commitment with what the team stored for it: owner, what it expects, what would make it reconsider, the disagreements it
 *     keeps open, its review date, core's trigger sentence, and the latest outcome;
 *   - one press that opens the ONE commitment form (`openCommitDraft`, the chat's and Team tab's shared draft and write).
 * Every word is the team's or core's; the section's labels are its chrome. Olumi writes none of the answers and picks no option.
 */
import type { View } from '../client'
import { pressCard } from './tabRing'
import { OkIcon } from '../look/icons'
import { isForThisPage, useMe } from '../../olumiCore/me'
import { useRevealedDifferences } from '../../olumiCore/team/CardDiffers'
import { WhereYouDiffer } from '../../olumiCore/team/CardDispute'
import type { Difference } from '../../olumiCore/team/differences'
import { useViewStore } from '../store'
import { COMMIT_WORDS, openCommitDraft } from '../v12/team/CommitForm'
import { TYPE } from '../port/type'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'
import { Door } from './parts'

/** The section's chrome (the record labels are the Team tab's own, SavedActions). */
export const COMMITMENT_WORDS = {
  heading: 'Towards commitment',
  open: 'Disagreements still open',
  recorded: 'Recorded',
  owner: 'Owner',
  expect: 'What we expect',
  reconsider: 'What would make us reconsider',
  keeps: 'Keeps open',
  review: 'Review on',
  happened: 'What happened',
} as const

const H = `${typography.viewPanelHeading} m-0 text-text-header`
const SUB = `${TYPE.meta} m-0 text-text-light`
const BUTTON = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 ${controls.act}`
const PRESS = 'flex w-full items-start gap-2 rounded-sm px-1 py-2.5 text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header'

type Commitment = View['collab']['commitments'][number]

/** One labelled line of a record, drawn only when the team wrote it. */
function Line({ label, text, testId }: { label: string; text: string | null | undefined; testId: string }) {
  if (text == null || text === '') return null
  return <span className={`${TYPE.meta} block whitespace-pre-wrap break-words text-text-body`} data-testid={testId}><span className="text-text-light">{label}: </span>{text}</span>
}

function Recorded({ k, view }: { k: Commitment; view: View }) {
  const c = view.collab
  const kept = (k.keeps ?? []).flatMap((id) => {
    const d = (c.dissent ?? []).find((x) => x.id === id)
    if (d !== undefined) return [`${d.holder === '' ? '' : `${d.holder}: `}${d.confirmed?.words ?? d.position}`]
    const label = (c.records ?? []).find((r) => r.id === id)?.label
    return label == null || label === '' ? [] : [label]
  })
  // Core sends a commitment's outcomes newest first (read-view ~213): the latest is the first, in the wire's order; nothing is sorted here.
  const last = (k.outcomes ?? [])[0]
  return (
    <li className="flex items-start gap-2 px-1" data-commitment={k.id}>
      <OkIcon id="commit-action" size={14} className="mt-0.5" decorative />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className={`${TYPE.body} block whitespace-pre-wrap break-words text-text-header`}>{k.action}</span>
        {k.option == null ? null : <span className={`${TYPE.meta} block break-words text-text-light`} data-commitment-option={k.id}>{k.option.heading}</span>}
        <Line label={COMMITMENT_WORDS.owner} text={k.owner} testId={`reasoning-commitment-owner-${k.id}`} />
        <Line label={COMMITMENT_WORDS.expect} text={k.expect} testId={`reasoning-commitment-expect-${k.id}`} />
        <Line label={COMMITMENT_WORDS.reconsider} text={k.reconsider} testId={`reasoning-commitment-reconsider-${k.id}`} />
        {kept.map((t, i) => <Line key={i} label={COMMITMENT_WORDS.keeps} text={t} testId={`reasoning-commitment-keep-${k.id}-${i}`} />)}
        {k.trigger == null || k.trigger.text === '' ? null : <span className={`${TYPE.meta} block break-words text-text-body`} data-testid={`reasoning-commitment-trigger-${k.id}`}>{k.trigger.text}</span>}
        <Line label={COMMITMENT_WORDS.review} text={k.review_on} testId={`reasoning-commitment-review-${k.id}`} />
        {last === undefined ? null : <Line label={COMMITMENT_WORDS.happened} text={last.happened} testId={`reasoning-commitment-happened-${k.id}`} />}
      </span>
    </li>
  )
}

export const displayedDissent = (d: View['collab']['dissent'][number]) => (d.confirmed?.words ?? d.position) !== ''

export function TowardsCommitment({ view }: { view: View }) {
  const sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at), me = useMe((s) => s.me)
  const differences = useRevealedDifferences()
  const c = view.collab, commitments = c.commitments ?? []
  // The form is offered only where it may be written: this page's own View, the latest version, for the person it is for.
  const reach = sid && at === null && isForThisPage(view, me) ? sid : null
  const dissent = (c.dissent ?? []).filter(displayedDissent)
  const records = dissent.length + commitments.length
  // Figure differences: one row per card (core may run one per aim; Team's WhereYouDiffer says every aim of that card). Others: core's sentence.
  const differ: { key: string; card: { id: string; heading: string } | null; d: Difference | null }[] = []
  for (const d of differences?.differences ?? []) {
    if (d.status_text === '') continue
    const card = (d.kind ?? 'figure') === 'figure' ? view.model?.cards.find((x) => x.id === d.record) ?? null : null
    if (card !== null) { if (!differ.some((x) => x.card?.id === card.id)) differ.push({ key: card.id, card, d: null }) }
    else differ.push({ key: `${d.record}|${d.goal}`, card: null, d })
  }
  if (reach === null && records + differ.length === 0) return null
  return (
    <section className="space-y-4" data-testid="reasoning-commitment" aria-label={COMMITMENT_WORDS.heading}>
      <h3 className={H}>{COMMITMENT_WORDS.heading}</h3>
      {differ.length === 0 || differences === null ? null : (
        <div className="space-y-2" data-testid="reasoning-commitment-differ">
          <p className={SUB}>{differences.heading}</p>
          <ul className="m-0 list-none space-y-3 p-0">
            {differ.map(({ key, card, d }) => (
              <li key={key} className={`${TYPE.body} space-y-1 px-1`} data-difference={key}>
                {card === null
                  // A link or a factor one member thinks is missing: core's sentence for what the difference does, nothing to press.
                  ? <p className="m-0 break-words text-text-body" data-testid="reasoning-difference-status">{d!.label === '' ? null : <span className="text-text-header">{d!.label}: </span>}{d!.status_text}</p>
                  : (
                    <>
                      <button type="button" className={`${PRESS} text-text-header`} onClick={() => pressCard(card.id)} data-testid="reasoning-difference-card">
                        <span className="min-w-0 flex-1 break-words" data-view={`${card.id}.heading`}>{card.heading}</span>
                      </button>
                      {/* The Team tab's own piece: core's sentence, each person's figure and chance, what would settle it. */}
                      <WhereYouDiffer card={card.id} />
                    </>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {records === 0 ? null : (
        <Door key={sid} label={COMMITMENT_WORDS.open} count={records} testId="commitment-records">
          {dissent.length === 0 ? null : <ul className="m-0 list-none divide-y divide-panel-border p-0" data-testid="reasoning-commitment-dissent">
            {dissent.map((d) => (
              <li key={d.id} data-dissent={d.id}>
                <button type="button" className={`${PRESS} ${TYPE.body} text-text-body`} onClick={() => pressCard(d.id)}>
                  <OkIcon id="challenged" size={14} className="mt-0.5" decorative />
                  <span className="min-w-0 flex-1 break-words">{d.holder === '' ? null : <span className="text-text-header">{d.holder}: </span>}{d.confirmed?.words ?? d.position}</span>
                </button>
              </li>
            ))}
          </ul>}
          {commitments.length === 0 ? null : (
            <div className="space-y-2" data-testid="reasoning-commitment-recorded">
              <p className={SUB}>{COMMITMENT_WORDS.recorded}</p>
              <ul className="m-0 list-none space-y-3 p-0">{commitments.map((k) => <Recorded key={k.id} k={k} view={view} />)}</ul>
            </div>
          )}
        </Door>
      )}
      {reach === null ? null : (
        <button type="button" className={BUTTON} onClick={() => openCommitDraft(reach, view)} data-testid="reasoning-commit-open">
          <OkIcon id="commit-action" size={14} decorative />{COMMIT_WORDS.heading}
        </button>
      )}
    </section>
  )
}
