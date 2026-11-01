import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { newOp, teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { wordsOfRecord } from './model'
import { BODY, CARD, ERR, FIELD, LABEL, META } from './ui'
import type { OutcomeVersus, TeamCommitmentRow, TeamScenario } from './types'

interface OutcomeDraft { open: boolean; happened: string; versus: OutcomeVersus | null; triggered: boolean | null; note: string; op: string }
const EMPTY: OutcomeDraft = { open: false, happened: '', versus: null, triggered: null, note: '', op: '' }
export const VERSUS: ReadonlyArray<{ value: OutcomeVersus; words: string }> = [
  { value: 'as_expected', words: 'As expected' },
  { value: 'better', words: 'Better than expected' },
  { value: 'worse', words: 'Worse than expected' },
  { value: 'mixed', words: 'Mixed' },
  { value: 'unclear', words: 'Too early to say' },
]
const versusWords = (v: OutcomeVersus): string => VERSUS.find((x) => x.value === v)?.words ?? v

/**
 * THE OUTCOME REVIEW (design plan step 10; v10 board 21), under the commitment it reviews. What happened in the team's own words, how it
 * went against the expectation (unset), and whether the reconsider point triggered (unset). Any member records one; none is edited or
 * judged by Olumi. The team's verdict on each kept disagreement is the team's to give, and core does not store one yet, so it is drawn
 * disabled: humans stay the authors.
 */
export function OutcomePanel({ sid, scenario, commitment, onWrote }: { sid: string; scenario: TeamScenario; commitment: TeamCommitmentRow; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = commitment
  // What is typed is kept while the tab is away (`drafts.ts`); `op` is one per attempt, so a send whose answer was lost is never recorded twice.
  const [d, setD, dropDraft] = useDraft<OutcomeDraft>(`${sid}:outcome:${c.id}`, EMPTY)
  const { open, happened, versus, triggered, note } = d
  const setOpen = (v: boolean) => setD((p) => ({ ...p, open: v }))
  const setHappened = (v: string) => setD((p) => ({ ...p, happened: v }))
  const setVersus = (v: OutcomeVersus) => setD((p) => ({ ...p, versus: v }))
  const setTriggered = (v: boolean) => setD((p) => ({ ...p, triggered: v }))
  const setNote = (v: string) => setD((p) => ({ ...p, note: v }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = happened.trim() !== '' && versus !== null && triggered !== null

  const save = async () => {
    if (!ready || versus === null || triggered === null) return
    setBusy(true); setError(null)
    const sendOp = d.op !== '' ? d.op : newOp()
    if (d.op === '') setD((p) => ({ ...p, op: sendOp }))
    try {
      await teamApi.addOutcome(sid, c.id, { happened, versus, reconsider_triggered: triggered, note: note.trim() === '' ? null : note }, sendOp)
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError && e.uncertain ? 'Olumi may not have received that. Send it again: it will not be recorded twice.' : e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  const name = `team-o-${c.id}`

  return (
    <div className="grid gap-2" data-testid={`team-outcomes-${c.id}`}>
      <p className={`${META} text-text-header`}>Outcome review</p>
      {c.outcomes.length === 0 && <p className={META} data-testid={`team-outcomes-empty-${c.id}`}>Nothing recorded yet. When it has played out, say what happened against what you expected.</p>}
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {c.outcomes.map((o) => (
          <li key={o.id} data-testid={`team-outcome-${o.id}`} className={CARD}>
            <p className={`${META} text-text-header`}>{o.by} · {versusWords(o.versus)} · reconsider point {o.reconsider_triggered ? 'triggered' : 'not triggered'}</p>
            <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid={`team-outcome-happened-${o.id}`}>{o.happened}</p>
            {o.note !== null && <p className={`${META} whitespace-pre-wrap break-words`}>{o.note}</p>}
          </li>
        ))}
      </ul>
      {c.keeps.length > 0 && (
        <div className="grid gap-1" data-testid={`team-verdicts-${c.id}`}>
          <p className={META}>The team’s verdict on each disagreement it kept is the team’s to give, not Olumi’s. It comes when Olumi can store it.</p>
          {c.keeps.map((id) => (
            <label key={id} className={`${META} grid gap-0.5`}>
              <span>{wordsOfRecord(scenario, id) ?? 'A disagreement the model no longer holds'}</span>
              <select className={FIELD} disabled aria-label={`Verdict on ${wordsOfRecord(scenario, id) ?? id}`}><option value="" /></select>
            </label>
          ))}
        </div>
      )}

      {!open ? (
        <div><Button size="sm" variant="secondary" data-testid={`team-outcome-open-${c.id}`} onClick={() => setOpen(true)}>Record what happened</Button></div>
      ) : (
        <div className={CARD} data-testid={`team-outcome-form-${c.id}`}>
          <label htmlFor={`${name}-happened`} className={LABEL}>What happened, in your own words?</label>
          <textarea id={`${name}-happened`} data-testid={`${name}-happened`} className={`${FIELD} min-h-[64px]`} value={happened} disabled={busy} onChange={(e) => setHappened(e.target.value)} />
          <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid={`${name}-versus`}>
            <legend className={LABEL}>Against what you expected</legend>
            {VERSUS.map((v) => (
              <label key={v.value} className={`${BODY} flex min-h-[28px] cursor-pointer items-center gap-2`}>
                <input type="radio" name={`${name}-versus`} value={v.value} checked={versus === v.value} disabled={busy} onChange={() => setVersus(v.value)} />{v.words}
              </label>
            ))}
          </fieldset>
          <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid={`${name}-triggered`}>
            <legend className={LABEL}>Did the point to reconsider come up?</legend>
            {[{ v: true, w: 'Yes, it came up' }, { v: false, w: 'No, it did not' }].map((x) => (
              <label key={String(x.v)} className={`${BODY} flex min-h-[28px] cursor-pointer items-center gap-2`}>
                <input type="radio" name={`${name}-triggered`} checked={triggered === x.v} disabled={busy} onChange={() => setTriggered(x.v)} />{x.w}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${name}-note`} className={LABEL}>Anything else (optional)</label>
          <textarea id={`${name}-note`} data-testid={`${name}-note`} className={`${FIELD} min-h-[48px]`} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert" data-testid={`${name}-error`} className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid={`${name}-save`} disabled={!ready || busy} onClick={() => void save()}>Record outcome</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
