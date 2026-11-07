/**
 * Strategy lane, slice 1: a person adds a qualitative view on one card from the dock, in their own words, with a stance and a source. The
 * cards are the model's (their headings as core names them); the stance words are core's (GET …/strategy/vocabulary), read once; the post is
 * core's own `POST …/views` with `items` (olumi-core API.md, "Strategy"), through the Team tab's one write path (writes.ts runWrite: a lost
 * answer locks it, never a second send). Private until revealed, like any view. Mount: inside the V11 build's ViewsPanel, by agreement.
 */
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { call, TeamApiError } from '../../olumiCore/team/api'
import { BODY, ERR, FIELD, LABEL, META } from '../../olumiCore/team/ui'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from '../../olumiCore/team/writes'
import type { View } from '../client'

type FormWords = { about: string; stance: string; text: string; source: string; source_example: string; send: string; private: string }
type Vocabulary = { kinds: { id: string; text: string }[]; stances: { id: string; text: string; word?: string }[]; form: FormWords; limits: { text: number; source: number; concerns: number; items: number } }
const FAMILIES = new Set(['quantity', 'option', 'risk', 'goal'])
const isVocabulary = (v: unknown): v is Vocabulary => {
  const x = v as Partial<Vocabulary> | null
  return x !== null && typeof x === 'object' && Array.isArray(x.stances) && x.stances.length > 0 && x.stances.every((s) => typeof s?.id === 'string' && typeof s?.text === 'string')
    && typeof x.limits === 'object' && x.limits !== null && typeof x.limits.text === 'number' && typeof x.limits.source === 'number'
    // Every word on the form is core's (`form`): a core that sends none draws no form rather than one in words of the page's own.
    && typeof x.form === 'object' && x.form !== null && (['about', 'stance', 'text', 'source', 'source_example', 'send', 'private'] as const).every((k) => typeof x.form![k] === 'string' && x.form![k] !== '')
}

export function StrategyCompose({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => unknown }): JSX.Element | null {
  const [vocab, setVocab] = useState<Vocabulary | null>(null)
  const [about, setAbout] = useState<string>('')
  const [stance, setStance] = useState<string>('')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:strategy-view`
  const locked = useWriteLocked(key), sending = useWriteSending(key)
  const cards = (view.model?.cards ?? []).filter((c) => FAMILIES.has(c.family))
  useEffect(() => {
    let live = true
    // Core's vocabulary or nothing: a core without the strategy lane (or any answer not in its shape) leaves the form undrawn, never an error
    // in the Team tab, since the person asked for nothing yet.
    call<unknown>('GET', `/api/scenarios/${encodeURIComponent(sid)}/strategy/vocabulary`)
      .then((v) => { if (live && isVocabulary(v)) { setVocab(v); setStance((s) => s || v.stances[0]?.id || '') } })
      .catch(() => undefined)
    return () => { live = false }
  }, [sid])
  useEffect(() => { setAbout((a) => a || cards[0]?.id || '') }, [cards.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (vocab === null) return error === null ? null : <p role="alert" className={ERR}>{error}</p>
  const ready = about !== '' && stance !== '' && text.trim() !== '' && !locked && !sending
  const send = async () => {
    setError(null)
    try {
      // Core keeps an operation id for a view (`op`): a retry of the same view sends the same id and gets the first answer, never a second view.
      const body = { text: text.trim(), version: view.version?.n ?? null, items: [{ about, stance, text: text.trim(), source: source.trim() === '' ? null : source.trim() }] }
      await runWrite(key, { op: true }, body, (op) => call('POST', `/api/scenarios/${encodeURIComponent(sid)}/views`, { ...body, ...(op === null ? {} : { op }) }))
      setText(''); setSource('')
      await onWrote()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') }
  }
  return (
    <div className="grid gap-2" data-testid="strategy-compose">
      <label className={LABEL}>{vocab.form.about}
        <select data-testid="strategy-compose-about" className={`${FIELD} mt-1`} value={about} onChange={(e) => setAbout(e.target.value)}>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.heading}</option>)}
        </select>
      </label>
      <label className={LABEL}>{vocab.form.stance}
        <select data-testid="strategy-compose-stance" className={`${FIELD} mt-1`} value={stance} onChange={(e) => setStance(e.target.value)}>
          {vocab.stances.map((s) => <option key={s.id} value={s.id}>{s.text}</option>)}
        </select>
      </label>
      <textarea data-testid="strategy-compose-text" className={`${FIELD} min-h-[72px]`} maxLength={vocab.limits.text} value={text} onChange={(e) => setText(e.target.value)} aria-label={vocab.form.text} placeholder={vocab.form.text} />
      <input type="text" data-testid="strategy-compose-source" className={FIELD} maxLength={vocab.limits.source} value={source} onChange={(e) => setSource(e.target.value)} aria-label={vocab.form.source} placeholder={vocab.form.source_example} autoComplete="off" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" data-testid="strategy-compose-send" disabled={!ready} onClick={() => void send()}>{vocab.form.send}</Button>
        <span className={META}>{vocab.form.private}</span>
      </div>
      {error === null ? null : <p role="alert" className={ERR}>{error}</p>}
      {/* The Team tab's own words for a write whose answer was lost (writes.ts), as the view form above says it. */}
      {locked ? <p className={BODY}>{MAY_HAVE_SAVED}</p> : null}
    </div>
  )
}
