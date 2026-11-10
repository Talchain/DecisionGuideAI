import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { OutcomePanel } from './OutcomePanel'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from './writes'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import { dissentWords } from './DissentPanel'
import { currentModel, useViewStore } from '../../olumiView/store'
import { nonEmpty, savedTriggerOf } from '../../olumiView/tipping'
import { suggestedTriggersFor } from './triggers'

interface CommitmentDraft { open: boolean; action: string; owner: string; expect: string; reconsider: string; keeps: string[]; option?: string; reviewOn?: string; trigger?: string }
/** DL 10 Nov (two-person rehearsal on 55c0c03f, bounded-trial blocker): a next action can be gathering evidence before any option is
 *  chosen. The team says so explicitly, as an answer of their own; Olumi never picks an option for them, and Record never waits on one.
 *  Not a core option id (core ids are snake_case words), so it never collides; it is never sent: core's commit takes no option. */
export const NO_OPTION_YET = '-'
export const NO_OPTION_YET_WORDS = 'No option yet: gathering evidence'
const EMPTY: CommitmentDraft = { open: false, action: '', owner: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '' }

/**
 * THE COMMITMENT (spec §8 step 6) and its later review (step 7). The action, its owner from the team (`collab.owners`), what the team
 * expects and what would make it reconsider, all in the team's own words: Olumi writes none of them. A commitment may keep open the
 * dissent the approved model records (`collab.dissent`), so a disagreement is carried forward, not settled by the commitment. Each saved
 * commitment carries its outcome reviews.
 *
 * R2b (board 20, core's olumi.view/3 at d1fe5e2): it names the option the team commits to (their choice, unset) and the approved version on
 * screen, with an optional review date. The model's band for that option is shown only once the team has written what it expects, so
 * the expectation is theirs first; core keeps the band frozen with the commitment (`expect_band`).
 */
export function CommitmentPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [d, setD, dropDraft] = useDraft<CommitmentDraft>(`${sid}:commitment`, { ...EMPTY, owner: view.you_id })
  const { open, action, owner, expect, reconsider } = d
  const option = d.option ?? '', reviewOn = d.reviewOn ?? ''
  // A live option of the APPROVED version, and its band, from the approved model only (store.ts currentModel; R2 review P1-2): while a
  // proposal is held the View's model is the proposal's, so neither its options nor its bands are offered as version n's.
  const approved = useViewStore(currentModel)
  const pending = view.proposal !== null
  const options = (approved?.cards ?? []).filter((x) => x.family === 'option' && x.status === null)
  const chosen = options.find((x) => x.id === option) ?? null
  const noOptionYet = option === NO_OPTION_YET
  // Only dissent the approved model still records: a kept id core no longer holds is dropped, never sent.
  const keeps = (d.keeps ?? []).filter((id) => c.dissent.some((x) => x.id === id))
  const labelOf = (id: string) => view.collab.records.find((r) => r.id === id)?.label ?? null
  // Olumi's suggested trigger (D6) for the option chosen: optional, and sent only when the person took it. A taken one core no longer
  // suggests for this option (the model moved, another option chosen) is dropped, never sent.
  const suggestions = suggestedTriggersFor(c, chosen?.id ?? null)
  const taken = suggestions.find((t) => t.fact === d.trigger) ?? null
  const put = (p: Partial<CommitmentDraft>) => setD((x) => ({ ...x, ...p }))
  const [mine, setBusy] = useState(false)
  const sending = useWriteSending(`${sid}:commitment`)
  const busy = mine || sending
  const [error, setError] = useState<string | null>(null)
  // A commitment has no operation id in core: one whose answer was lost may have been saved, so it is locked, not sent again (`writes.ts`).
  const locked = useWriteLocked(`${sid}:commitment`)
  const ready = [action, expect, reconsider].every((t) => t.trim() !== '') && c.owners.some((o) => o.id === owner) && approved !== null && (options.length === 0 || chosen !== null || noOptionYet)

  const save = async () => {
    if (!ready || locked) return
    setBusy(true); setError(null)
    try {
      await runWrite(`${sid}:commitment`, { op: false }, null, () => teamApi.addCommitment(sid, { action, owner, expect, reconsider, keeps, option: chosen?.id ?? null, version: view.version?.n ?? null, review_on: reviewOn === '' ? null : reviewOn, trigger: taken === null ? null : taken.fact }))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-commitments" aria-label="Commitments" className="grid gap-2">
      <h3 className={H}>Commitments</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-commitment-list">
        {c.commitments.map((k) => (
          <li key={k.id} data-testid={`team-commitment-${k.id}`} className={CARD}>
            <p className={`${BODY} whitespace-pre-wrap break-words text-text-header`} data-testid={`team-commitment-action-${k.id}`}>{k.action}</p>
            <p className={META}>owner {k.owner} · set by {k.by}</p>
            {k.option != null && <p className={META} data-testid={`team-commitment-option-${k.id}`}>{k.option.heading}{k.version != null ? ` · version ${k.version}` : ''}</p>}
            {k.review_on != null && <p className={META} data-testid={`team-commitment-review-${k.id}`}>Review on {k.review_on}</p>}
            <dl className="m-0 grid gap-1">
              <div><dt className={META}>What we expect</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`} data-testid={`team-commitment-expect-${k.id}`}>{k.expect}</dd></div>
              <div><dt className={META}>What would make us reconsider</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`}>{k.reconsider}</dd></div>
              {k.expect_band != null && <div data-testid={`team-commitment-band-${k.id}`}><dt className={META}>The model's band for it then</dt><dd className={`${BODY} m-0`}>{k.expect_band.text}</dd></div>}
            </dl>
            {savedTriggerOf(k) !== null && (
              <div data-testid={`team-commitment-trigger-${k.id}`}>
                <p className={META}>Trigger Olumi suggested, taken</p>
                <p className={`${BODY} break-words`}>{savedTriggerOf(k)!.text}</p>
                {savedTriggerOf(k)!.stale !== null && <p className={`${BODY} break-words text-danger`} role="status" data-testid={`team-commitment-trigger-stale-${k.id}`}>{savedTriggerOf(k)!.stale!.text}</p>}
              </div>
            )}
            {k.keeps.map(labelOf).some((l) => l !== null) && <p className={META} data-testid={`team-commitment-keeps-${k.id}`}>Keeps open: {k.keeps.map(labelOf).filter((l): l is string => l !== null).join('; ')}</p>}
            {/* Each kept dissent's tell, in its holder's own words (board 20). */}
            {c.dissent.filter((x) => k.keeps.includes(x.id) && x.confirmed?.tell != null).map((x) => (
              <p key={x.id} className={`${META} whitespace-pre-wrap break-words`} data-testid={`team-commitment-keeps-tell-${k.id}-${x.id}`}>{x.holder}: what would tell them they are wrong: {x.confirmed!.tell}</p>
            ))}
            <OutcomePanel sid={sid} commitment={k} dissent={c.dissent} labelOf={labelOf} onWrote={onWrote} />
          </li>
        ))}
      </ul>

      {view.version === null ? (
        <p className={META} data-testid="team-commitment-unapproved">A commitment is made against an approved model. Approve the model in the chat first.</p>
      ) : !open ? (
        <div><Button size="sm" variant="secondary" data-testid="team-commitment-open" onClick={() => put({ open: true })}>Record the next action</Button></div>
      ) : (
        <div className={CARD} data-testid="team-commitment-form">
          <label htmlFor="team-c-action" className={LABEL}>The next action</label>
          <textarea id="team-c-action" data-testid="team-c-action" className={`${FIELD} min-h-[56px]`} value={action} disabled={busy} onChange={(e) => put({ action: e.target.value })} />
          <label htmlFor="team-c-owner" className={LABEL}>Who owns it</label>
          <select id="team-c-owner" data-testid="team-c-owner" className={FIELD} value={owner} disabled={busy} onChange={(e) => put({ owner: e.target.value })}>
            <option value="" disabled>Choose…</option>
            {c.owners.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {pending && <p className={META} data-testid="team-c-pending">The option is chosen from the approved model. Approve or set aside the proposal in the chat first.</p>}
          {options.length > 0 && (<>
            <label htmlFor="team-c-option" className={LABEL}>Which option this commits to</label>
            <select id="team-c-option" data-testid="team-c-option" className={FIELD} value={option} disabled={busy} onChange={(e) => put({ option: e.target.value })}>
              <option value="" disabled>Choose…</option>
              {options.map((x) => <option key={x.id} value={x.id}>{x.heading}</option>)}
              <option value={NO_OPTION_YET}>{NO_OPTION_YET_WORDS}</option>
            </select>
          </>)}
          <label htmlFor="team-c-expect" className={LABEL}>What we expect to see</label>
          <textarea id="team-c-expect" data-testid="team-c-expect" className={`${FIELD} min-h-[56px]`} value={expect} disabled={busy} onChange={(e) => put({ expect: e.target.value })} />
          {chosen !== null && expect.trim() !== '' && chosen.rows.some((r) => r.kind === 'chance' && r.outcome !== null) && (
            <div className={META} data-testid="team-c-band">
              <p className="m-0">The model's band for {chosen.heading}, in version {view.version?.n}:</p>
              {chosen.rows.map((r, i) => r.kind === 'chance' && r.outcome !== null ? <p key={i} className={`${BODY} m-0`} title={r.outcome.title}>{r.aim}: {r.outcome.text}</p> : null)}
            </div>
          )}
          <label htmlFor="team-c-reconsider" className={LABEL}>What would make us reconsider</label>
          <textarea id="team-c-reconsider" data-testid="team-c-reconsider" className={`${FIELD} min-h-[56px]`} value={reconsider} disabled={busy} onChange={(e) => put({ reconsider: e.target.value })} />
          {suggestions.length > 0 && (
            <div className="grid gap-1" data-testid="team-c-triggers">
              {nonEmpty(c.suggested_triggers_caption) && <p className={META} data-testid="team-suggested-trigger-caption">{c.suggested_triggers_caption}</p>}
              {suggestions.map((t) => {
                const on = taken?.fact === t.fact
                return (
                  <button key={t.fact} type="button" aria-pressed={on} data-testid={`team-c-trigger-${t.fact}`} disabled={busy}
                    onClick={() => put({ trigger: on ? '' : t.fact })}
                    className={`${BODY} flex min-h-[28px] items-start gap-2 rounded-md border px-2 py-1 text-left break-words ${on ? 'border-info bg-info/10' : 'border-panel-border bg-panel'}`}>
                    <span aria-hidden="true" className="flex-none">{on ? '✓' : '+'}</span><span>{t.text}</span>
                  </button>
                )
              })}
            </div>
          )}
          <label htmlFor="team-c-review-on" className={LABEL}>When to review it (optional)</label>
          <input id="team-c-review-on" type="date" data-testid="team-c-review-on" className={FIELD} value={reviewOn} disabled={busy} onChange={(e) => put({ reviewOn: e.target.value })} />
          {c.dissent.length > 0 && (
            <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid="team-c-keeps">
              <legend className={LABEL}>Disagreement this keeps open (optional)</legend>
              {c.dissent.map((x) => (
                <label key={x.id} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2`}>
                  <input type="checkbox" className="mt-1" data-testid={`team-c-keep-${x.id}`} checked={keeps.includes(x.id)} disabled={busy}
                    onChange={(e) => put({ keeps: e.target.checked ? [...keeps, x.id] : keeps.filter((id) => id !== x.id) })} />
                  <span className="grid gap-0.5 break-words">
                    <span>{x.holder}: {dissentWords(x)}</span>
                    {x.confirmed?.tell != null && <span className={META} data-testid={`team-c-keep-tell-${x.id}`}>What would tell {x.holder} they are wrong: {x.confirmed.tell}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {locked ? <p role="alert" data-testid="team-commitment-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-commitment-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-commitment-save" disabled={!ready || busy || locked} onClick={() => void save()}>Record it</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ open: false })}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  )
}
