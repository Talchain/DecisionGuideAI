import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { runWrite, useWriteSending } from './writes'
import { putDraft, useDraft } from './drafts'
import type { View } from '../../olumiView/client'
import { dissentWords } from './DissentPanel'
import { BODY, CARD, ERR, FIELD, LABEL, META } from './ui'

/** Core's verdict on a kept dissent (olumi.view/3 at d1fe5e2), and the words this panel says for each. */
type Verdict = View['collab']['commitments'][number]['outcomes'][number]['dissent'][number]['verdict']
const VERDICTS: ReadonlyArray<{ value: Verdict; words: string }> = [
  { value: 'resolved', words: 'Resolved' },
  { value: 'partly_right', words: 'Partly right' },
  { value: 'not_yet_known', words: 'Not yet known' },
]
const verdictWords = (v: Verdict): string => VERDICTS.find((x) => x.value === v)?.words ?? v

type OutcomeVersus = 'as_expected' | 'better' | 'worse' | 'mixed' | 'unclear'
type Commitment = View['collab']['commitments'][number]
type Dissent = View['collab']['dissent'][number]

interface OutcomeDraft { open: boolean; happened: string; versus: OutcomeVersus | null; triggered: boolean | null; note: string; figure?: string; verdicts?: Record<string, Verdict> }
const EMPTY: OutcomeDraft = { open: false, happened: '', versus: null, triggered: null, note: '', figure: '', verdicts: {} }
export const VERSUS: ReadonlyArray<{ value: OutcomeVersus; words: string }> = [
  { value: 'as_expected', words: 'As expected' },
  { value: 'better', words: 'Better than expected' },
  { value: 'worse', words: 'Worse than expected' },
  { value: 'mixed', words: 'Mixed' },
  { value: 'unclear', words: 'Too early to say' },
]
const versusWords = (v: string): string => VERSUS.find((x) => x.value === v)?.words ?? v

/** Open a commitment's outcome form from elsewhere on the tab (the nudge for a next action with no outcome yet): its draft, kept as typed. */
export function openOutcome(sid: string, id: number): void {
  const key = `${sid}:outcome:${id}`
  putDraft<OutcomeDraft>(key, (d) => ({ ...(d ?? EMPTY), open: true }))
}

/**
 * THE OUTCOME REVIEW (spec §8 step 7), under the commitment it reviews: what happened in the team's own words, how it went against the
 * expectation and whether the reconsider point came up, none preset. Any member records one; none is edited, and Olumi does not judge it.
 *
 * R2b (board 21, core's olumi.view/3 at d1fe5e2): the figure that came about (optional, a number in the unit of the band frozen with the
 * commitment; offered only when there is one, as core takes no figure without it), and the team's verdict on each dissent the
 * commitment keeps that the model still records, none preset and each needed: the team judges its dissent, not Olumi.
 */
export function OutcomePanel({ sid, commitment, dissent, labelOf, onWrote }: { sid: string; commitment: Commitment; dissent: readonly Dissent[]; labelOf: (id: string) => string | null; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = commitment
  const [d, setD, dropDraft] = useDraft<OutcomeDraft>(`${sid}:outcome:${c.id}`, EMPTY)
  const { open, happened, versus, triggered, note } = d
  const figure = d.figure ?? '', verdicts = d.verdicts ?? {}
  const kept = dissent.filter((x) => c.keeps.includes(x.id))
  const setFigure = (v: string) => setD((p) => ({ ...p, figure: v }))
  const setVerdict = (id: string, v: Verdict) => setD((p) => ({ ...p, verdicts: { ...(p.verdicts ?? {}), [id]: v } }))
  // A View from a core before R2b has no R2b keys: absent reads as none (`?? null`, `!= null`, `?? []`), never a crash.
  const band = c.expect_band ?? null
  const figureValue = figure.trim() === '' ? null : Number(figure)
  const setOpen = (v: boolean) => setD((p) => ({ ...p, open: v }))
  const setHappened = (v: string) => setD((p) => ({ ...p, happened: v }))
  const setVersus = (v: OutcomeVersus) => setD((p) => ({ ...p, versus: v }))
  const setTriggered = (v: boolean) => setD((p) => ({ ...p, triggered: v }))
  const setNote = (v: string) => setD((p) => ({ ...p, note: v }))
  const [mine, setBusy] = useState(false)
  const sending = useWriteSending(`${sid}:outcome:${c.id}`)
  const busy = mine || sending
  const [error, setError] = useState<string | null>(null)
  const ready = happened.trim() !== '' && versus !== null && triggered !== null && (figureValue === null || Number.isFinite(figureValue)) && kept.every((x) => verdicts[x.id] !== undefined)

  const save = async () => {
    if (!ready || versus === null || triggered === null) return
    setBusy(true); setError(null)
    const input = { happened, versus, reconsider_triggered: triggered, note: note.trim() === '' ? null : note, figure: figureValue, dissent: kept.map((x) => ({ id: x.id, verdict: verdicts[x.id]! })) }
    try {
      await runWrite(`${sid}:outcome:${c.id}`, { op: true }, input, (op) => teamApi.addOutcome(sid, c.id, input, op!))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
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
            {o.figure != null && <p className={META} data-testid={`team-outcome-figure-${o.id}`}>What came about: {o.figure.text}</p>}
            {(o.dissent ?? []).map((v) => <p key={v.id} className={META} data-testid={`team-outcome-verdict-${o.id}-${v.id}`}>{labelOf(v.id) ?? v.id} · {verdictWords(v.verdict)} · {v.by}</p>)}
            {o.note !== null && <p className={`${META} whitespace-pre-wrap break-words`}>{o.note}</p>}
          </li>
        ))}
      </ul>
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
          {band !== null && (<>
            <label htmlFor={`${name}-figure`} className={LABEL}>The figure that came about{band.unit !== null ? `, in ${band.unit}` : ''} (optional)</label>
            <input id={`${name}-figure`} type="number" inputMode="decimal" data-testid={`${name}-figure`} className={FIELD} value={figure} disabled={busy} onChange={(e) => setFigure(e.target.value)} />
          </>)}
          {kept.map((x) => (
            <fieldset key={x.id} className="m-0 grid gap-1 border-0 p-0" data-testid={`${name}-verdict-${x.id}`}>
              <legend className={LABEL}>The team's verdict on {x.holder}: {dissentWords(x)}</legend>
              {VERDICTS.map((v) => (
                <label key={v.value} className={`${BODY} flex min-h-[28px] cursor-pointer items-center gap-2`}>
                  <input type="radio" name={`${name}-verdict-${x.id}`} checked={verdicts[x.id] === v.value} disabled={busy} onChange={() => setVerdict(x.id, v.value)} />{v.words}
                </label>
              ))}
            </fieldset>
          ))}
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
