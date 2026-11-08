import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'
import { differencesKey, readDifferences, useDifferences } from './differences'
import { runWrite } from './writes'
import { offeredOf } from './ViewDoubts'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'

/**
 * WHERE YOU STAND ON A LINK (core `POST …/links/stance`, API v1.30; DL 8 Nov, X2 step 3). After the reveal a member says whether they doubt
 * one link of the model or keep it, in their own words: shared at once (core says so in the note), the newest word of theirs on that link
 * counts, and it shows on the link's chip and, where someone else holds the other stance, in "Where your explanations differ".
 *
 * Every word is core's: the form's (`link_stance` on the differences read), the links' (`model.holdable`, as "Links you doubt" offers them)
 * and every refusal (drawn verbatim). Neither stance is chosen for the person: Send stays held until they pick a link, a stance and say why.
 * A core without these words, a gated viewer, a proposal on screen or a round with nothing revealed draws nothing.
 */
export interface StanceWords { readonly heading: string; readonly note: string; readonly link: string; readonly doubt: string; readonly keep: string; readonly words: string; readonly limit: number; readonly send: string }
const WORD_KEYS = ['heading', 'note', 'link', 'doubt', 'keep', 'words', 'send'] as const
/** Core's form words, or null: a read without them (an older core) draws no form. */
export function stanceWordsOf(x: unknown): StanceWords | null {
  const w = x as Record<string, unknown> | null | undefined
  if (w == null || typeof w !== 'object' || !WORD_KEYS.every((k) => typeof w[k] === 'string' && (w[k] as string) !== '')) return null
  return typeof w['limit'] === 'number' && Number.isInteger(w['limit']) && w['limit'] > 0 ? (w as unknown as StanceWords) : null
}
const keyOf = (l: { record: string; part: string | null }) => `${l.record}|${l.part ?? ''}`

export function LinkStance({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const data = useDifferences((s) => (s.sid === sid ? s.data : null))
  const words = stanceWordsOf((data as { link_stance?: unknown } | null)?.link_stance)
  const [pick, setPick] = useState('')
  const [stance, setStance] = useState<'doubt' | 'keep' | null>(null)
  const [said, setSaid] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cards = view.model?.cards ?? []
  const heading = (id: string) => cards.find((c) => c.id === id)?.heading ?? id
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  // Only a core that holds `model.holdable` takes a stance (it checks the link against it); after a reveal this viewer can read.
  if (words === null || data === null || data.gated || view.gated || view.version === null || shownIsProposal || view.model?.holdable == null || view.collab.shared.length === 0) return null
  const links = offeredOf(view, heading)
  if (links.length === 0) return null
  const chosen = links.find((l) => keyOf(l.link) === pick)
  const ready = chosen !== undefined && stance !== null && said.trim() !== '' && !busy
  const at = 'team-link-stance'
  const send = async () => {
    if (!ready) return
    const body = { record: chosen.link.record, part: chosen.link.part, stance, words: said.trim() }
    setBusy(true); setError(null)
    // Core keys a stance by its op, so a re-send after a lost answer is the first stance, never a second.
    try {
      await runWrite(`${sid}:link-stance`, { op: true }, body, (op) => call<{ stance: number }>('POST', `/api/scenarios/${encodeURIComponent(sid)}/links/stance`, { ...body, op }))
      setPick(''); setStance(null); setSaid('')
      await readDifferences(sid, differencesKey(sid, view))
      await onWrote()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }
  return (
    <section className={CARD} data-testid={at} aria-label={words.heading}>
      <h3 className={H} data-testid={`${at}-heading`}>{words.heading}</h3>
      <p className={META} data-testid={`${at}-note`}>{words.note}</p>
      <label className={`${META} grid gap-0.5`}>
        <span className="text-text-header">{words.link}</span>
        <select data-testid={`${at}-link`} className={FIELD} value={pick} disabled={busy} onChange={(e) => { setPick(e.target.value); setError(null) }}>
          <option value="" />
          {links.map((l) => <option key={keyOf(l.link)} value={keyOf(l.link)} title={l.title}>{l.text}</option>)}
        </select>
      </label>
      <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid={`${at}-stance`}>
        <legend className="sr-only">{words.heading}</legend>
        {(['doubt', 'keep'] as const).map((s) => (
          <label key={s} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2 break-words`}>
            <input type="radio" name={`${at}-${sid}`} className="mt-1" data-testid={`${at}-${s}`} checked={stance === s} disabled={busy} onChange={() => { setStance(s); setError(null) }} />
            <span>{words[s]}</span>
          </label>
        ))}
      </fieldset>
      <label className={`${META} grid gap-0.5`}>
        <span className={LABEL}>{words.words}</span>
        <textarea data-testid={`${at}-words`} className={`${FIELD} min-h-[56px]`} maxLength={words.limit} value={said} disabled={busy} onChange={(e) => { setSaid(e.target.value); setError(null) }} />
      </label>
      <div><Button size="sm" data-testid={`${at}-send`} disabled={!ready} onClick={() => void send()}>{words.send}</Button></div>
      {error ? <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p> : null}
    </section>
  )
}
