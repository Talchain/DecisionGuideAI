/**
 * Strategy lane, slice 1, folded into the Team tab's one view form (N2, UI 7 Nov): a person's view can speak to one card of the model, with
 * a stance and a source. These are the form's extra fields, not a form of their own: the view's own words are the item's words, and the
 * one post is core's `POST …/views` with `text`, `figures` and `items` together (olumi-core wip/strategy-n2c 5bfc55d7: src/server/app.ts:348-350
 * passes `items` to `service.contribute`, src/app/service.ts:474-488 stores them on the same private view; API.md:615). Every word is core's
 * (GET …/strategy/vocabulary `form`, `stances`, `limits`), read once; a core without the lane, or an answer not in the vocabulary's shape,
 * draws none of these fields and the view form is as it was. The cards are the model's, by their headings as core names them.
 */
import { useEffect, useState } from 'react'
import { call } from '../../olumiCore/team/api'
import { FIELD, LABEL } from '../../olumiCore/team/ui'
import type { View } from '../client'

type FormWords = { about: string; stance: string; text: string; source: string; source_example: string; send: string; private: string }
export type Vocabulary = { kinds: { id: string; text: string }[]; stances: { id: string; text: string; word?: string }[]; form: FormWords; limits: { text: number; source: number; concerns: number; items: number } }
const FAMILIES = new Set(['quantity', 'option', 'risk', 'goal'])
const isVocabulary = (v: unknown): v is Vocabulary => {
  const x = v as Partial<Vocabulary> | null
  return x !== null && typeof x === 'object' && Array.isArray(x.stances) && x.stances.length > 0 && x.stances.every((s) => typeof s?.id === 'string' && typeof s?.text === 'string')
    && typeof x.limits === 'object' && x.limits !== null && typeof x.limits.text === 'number' && typeof x.limits.source === 'number'
    // Every word on the fields is core's (`form`): a core that sends none draws no fields rather than ones in words of the page's own.
    && typeof x.form === 'object' && x.form !== null && (['about', 'stance', 'text', 'source', 'source_example', 'send', 'private'] as const).every((k) => typeof x.form![k] === 'string' && x.form![k] !== '')
}

/** Core's vocabulary for this scenario, or null (not yet answered, no strategy lane, or not in its shape: never an error, nothing was asked). */
export function useStrategyVocabulary(sid: string): Vocabulary | null {
  const [vocab, setVocab] = useState<Vocabulary | null>(null)
  useEffect(() => {
    let live = true
    setVocab(null)
    call<unknown>('GET', `/api/scenarios/${encodeURIComponent(sid)}/strategy/vocabulary`)
      .then((v) => { if (live && isVocabulary(v)) setVocab(v) })
      .catch(() => undefined)
    return () => { live = false }
  }, [sid])
  return vocab
}

/** What the person chose: the card the view speaks to ('' for none: a plain view), the stance and the source. */
export type StrategyPick = { about: string; stance: string; source: string }
export const NO_PICK: StrategyPick = { about: '', stance: '', source: '' }

/** The view's one item, or none: only when the person chose a card. The item's words are the view's own (core keeps them on the view). */
export function itemsOf(pick: StrategyPick, vocab: Vocabulary | null, text: string): { about: string; stance: string; text: string; source: string | null }[] {
  if (vocab === null || pick.about === '') return []
  const stance = pick.stance || vocab.stances[0]!.id
  return [{ about: pick.about, stance, text: text.trim(), source: pick.source.trim() === '' ? null : pick.source.trim() }]
}

/** The cards a view can speak to, in the model's order. */
export const strategyCards = (view: View) => (view.model?.cards ?? []).filter((c) => FAMILIES.has(c.family))

/** The fields, in core's words: a card (none chosen at rest, so a plain view stays one), a stance and a source. */
export function StrategyFields({ vocab, view, pick, onPick, disabled }: { vocab: Vocabulary; view: View; pick: StrategyPick; onPick: (p: StrategyPick) => void; disabled: boolean }) {
  const cards = strategyCards(view)
  if (cards.length === 0) return null
  return (
    <div className="grid gap-2" data-testid="team-view-strategy">
      <label className={LABEL}>{vocab.form.about}
        <select data-testid="team-view-about" className={`${FIELD} mt-1`} value={pick.about} disabled={disabled} onChange={(e) => onPick({ ...pick, about: e.target.value })}>
          <option value="" />
          {cards.map((c) => <option key={c.id} value={c.id}>{c.heading}</option>)}
        </select>
      </label>
      {pick.about === '' ? null : (
        <>
          <label className={LABEL}>{vocab.form.stance}
            <select data-testid="team-view-stance" className={`${FIELD} mt-1`} value={pick.stance || vocab.stances[0]!.id} disabled={disabled} onChange={(e) => onPick({ ...pick, stance: e.target.value })}>
              {vocab.stances.map((s) => <option key={s.id} value={s.id}>{s.text}</option>)}
            </select>
          </label>
          <input type="text" data-testid="team-view-source" className={FIELD} maxLength={vocab.limits.source} value={pick.source} disabled={disabled}
            onChange={(e) => onPick({ ...pick, source: e.target.value })} aria-label={vocab.form.source} placeholder={vocab.form.source_example} autoComplete="off" />
        </>
      )}
    </div>
  )
}
