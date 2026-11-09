import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'
import { differencesKey, readDifferences, useDifferences } from './differences'
import { runWrite } from './writes'
import { offeredOf } from './ViewDoubts'
import { useTakeLinkPick } from './linkPick'
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
/** `pick` (the picker's prompt) and `yours` (the heading over what this member has said) came later (core 41765715): drawn when core gives them. */
export interface StanceWords { readonly heading: string; readonly note: string; readonly link: string; readonly doubt: string; readonly keep: string; readonly words: string; readonly limit: number; readonly send: string; readonly pick?: string; readonly yours?: string }
const WORD_KEYS = ['heading', 'note', 'link', 'doubt', 'keep', 'words', 'send'] as const
const said = (x: unknown): x is string => typeof x === 'string' && x !== ''
/** Core's form words, or null: a read without them (an older core) draws no form. */
export function stanceWordsOf(x: unknown): StanceWords | null {
  const w = x as Record<string, unknown> | null | undefined
  if (w == null || typeof w !== 'object' || !WORD_KEYS.every((k) => said(w[k]))) return null
  if (!(typeof w['limit'] === 'number' && Number.isInteger(w['limit']) && w['limit'] > 0)) return null
  const { pick, yours, ...rest } = w as unknown as StanceWords
  return { ...rest, ...(said(pick) ? { pick } : {}), ...(said(yours) ? { yours } : {}) }
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
  const headingId = useId()
  const cards = view.model?.cards ?? []
  const heading = (id: string) => cards.find((c) => c.id === id)?.heading ?? id
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  // A link's chip asks for its link (linkPick.ts, Paul's step 6): picked here once this form offers it.
  useTakeLinkPick(view.model?.holdable == null ? [] : offeredOf(view, heading).map((l) => keyOf(l.link)), (k) => { setPick(k); setError(null) })
  // Only a core that holds `model.holdable` takes a stance (it checks the link against it). One place at a time (DL 9 Nov): core's
  // `collab.link_route` says when ('stance': the View shows this member a reveal); a core before it, once anything is revealed to them.
  const route = view.collab.link_route, here = route !== undefined ? route === 'stance' : view.collab.shared.length > 0
  if (words === null || data === null || data.gated || view.gated || view.version === null || shownIsProposal || view.model?.holdable == null || !here) return null
  const links = offeredOf(view, heading)
  if (links.length === 0) return null
  const chosen = links.find((l) => keyOf(l.link) === pick)
  // What this member has said on this version (the View's own link chips, their newest word on each link): so they see they have spoken.
  const mine = (view.collab.link_marks ?? []).flatMap((m) => m.stances.filter((x) => x.by_id === view.you_id).map((x) => ({ key: keyOf(m.link), text: links.find((l) => keyOf(l.link) === keyOf(m.link))?.text ?? null, stance: x.stance, words: x.words })))
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
    // The heading is said once: the section and the stance group are both named by it (no second label to read out).
    <section className={CARD} data-testid={at} aria-labelledby={headingId}>
      <h3 id={headingId} className={H} data-testid={`${at}-heading`}>{words.heading}</h3>
      <p className={META} data-testid={`${at}-note`}>{words.note}</p>
      {words.yours !== undefined && mine.length > 0 && (
        <div className="grid gap-1" data-testid={`${at}-yours`}>
          <p className={LABEL}>{words.yours}</p>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {mine.map((x) => (
              <li key={x.key} className={`${BODY} grid gap-0.5 break-words`} data-link-said={x.key}>
                {x.text !== null && <span className="text-text-header">{x.text}</span>}
                <span>{words[x.stance]}</span>
                {/* Her own words in body colour, as everywhere a person's words are read (the UI lane, 9 Nov; gate grade 2 polish). */}
                {x.words ? <span className="text-text-body" data-link-said-words="">{x.words}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className={`${META} grid gap-0.5`}>
        <span className="text-text-header">{words.link}</span>
        <select data-testid={`${at}-link`} className={FIELD} value={pick} disabled={busy} onChange={(e) => { setPick(e.target.value); setError(null) }}>
          <option value="">{words.pick ?? ''}</option>
          {links.map((l) => <option key={keyOf(l.link)} value={keyOf(l.link)} title={l.title}>{l.text}</option>)}
        </select>
      </label>
      <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid={`${at}-stance`} aria-labelledby={headingId}>
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
      {/* A person's own stance, not Olumi's: ink, never blue (blue is only for what is Olumi's). */}
      <div><Button size="sm" variant="secondary" data-testid={`${at}-send`} disabled={!ready} onClick={() => void send()}>{words.send}</Button></div>
      {error ? <p role="alert" className={ERR} data-testid={`${at}-error`}>{error}</p> : null}
    </section>
  )
}
