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
import { runWrite, useWriteLocked, useWriteSending } from '../../olumiCore/team/writes'
import type { View } from '../client'

type Vocabulary = { kinds: { id: string; text: string }[]; stances: { id: string; text: string }[]; limits: { text: number; source: number; concerns: number; items: number } }
const FAMILIES = new Set(['quantity', 'option', 'risk', 'goal'])

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
    call<Vocabulary>('GET', `/api/scenarios/${encodeURIComponent(sid)}/strategy/vocabulary`)
      .then((v) => { if (live) { setVocab(v); setStance((s) => s || v.stances[0]?.id || '') } })
      .catch((e: unknown) => { if (live) setError(e instanceof TeamApiError ? e.message : 'Olumi could not be read just now.') })
    return () => { live = false }
  }, [sid])
  useEffect(() => { setAbout((a) => a || cards[0]?.id || '') }, [cards.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (vocab === null) return error === null ? null : <p role="alert" className={ERR}>{error}</p>
  const ready = about !== '' && stance !== '' && text.trim() !== '' && !locked && !sending
  const send = async () => {
    setError(null)
    try {
      await runWrite(key, { op: false }, null, () => call('POST', `/api/scenarios/${encodeURIComponent(sid)}/views`, {
        text: text.trim(), version: view.version?.n ?? null, items: [{ about, stance, text: text.trim(), source: source.trim() === '' ? null : source.trim() }] }))
      setText(''); setSource('')
      await onWrote()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') }
  }
  return (
    <div className="grid gap-2" data-testid="strategy-compose">
      <label className={LABEL}>On
        <select data-testid="strategy-compose-about" className={`${FIELD} mt-1`} value={about} onChange={(e) => setAbout(e.target.value)}>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.heading}</option>)}
        </select>
      </label>
      <label className={LABEL}>You
        <select data-testid="strategy-compose-stance" className={`${FIELD} mt-1`} value={stance} onChange={(e) => setStance(e.target.value)}>
          {vocab.stances.map((s) => <option key={s.id} value={s.id}>{s.text}</option>)}
        </select>
      </label>
      <textarea data-testid="strategy-compose-text" className={`${FIELD} min-h-[72px]`} maxLength={vocab.limits.text} value={text} onChange={(e) => setText(e.target.value)} aria-label="What you hold about it, in your words" placeholder="What you hold about it, in your words" />
      <input type="text" data-testid="strategy-compose-source" className={FIELD} maxLength={vocab.limits.source} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source, if you have one" placeholder="Source, if you have one (two rollouts, a report…)" autoComplete="off" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" data-testid="strategy-compose-send" disabled={!ready} onClick={() => void send()}>Add my view</Button>
        <span className={META}>Private until the team’s views are revealed.</span>
      </div>
      {error === null ? null : <p role="alert" className={ERR}>{error}</p>}
      {locked ? <p className={BODY}>Reload the page to see what Olumi holds.</p> : null}
    </div>
  )
}
