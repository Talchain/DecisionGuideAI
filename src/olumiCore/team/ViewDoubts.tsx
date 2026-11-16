import { create } from 'zustand'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'
import { runWrite, useWrites, useWriteSending } from './writes'
import { BODY, ERR, FIELD, LABEL, META } from './ui'
import { useDifferences } from './differences'

/**
 * A private view's links and factor (core `POST …/views/:id/doubts`, olumi-core wip/debate): the links of the model this member doubts (each
 * as the View holds it, `model.holdable`, sent verbatim: every line the model draws and every link it folds into a card, the disputed ones too;
 * a core before it offers `links[].remove`) and a factor they think the model leaves out, in their own words. Private with the
 * view: core shows them only once the view is shown, and then runs the model with and without each doubted link ("Where your explanations
 * differ"). Held here until the view is given, then sent with its id; dropped with the view's draft.
 */
type Remove = NonNullable<NonNullable<View['model']>['links'][number]['remove']>
interface DoubtsDraft { readonly picked: Readonly<Record<string, Remove>>; readonly missing: string; readonly error?: string | null }
const useDoubts = create<Record<string, DoubtsDraft>>()(() => ({}))
/** A second save that failed after its view was saved, by scenario and saved view id: exactly what was sent, so a retry sends that and only
 *  that (never the view again, never what is typed for the next view). `uncertain`: the answer was lost, so it may have been saved and is
 *  not sent again from this page (writes.ts locks it; core keeps one per view and refuses a second). */
interface Pending { readonly body: { readonly links: readonly Remove[]; readonly missing: string | null; readonly stance: string | null }; readonly error: string; readonly uncertain: boolean }
const usePending = create<Record<string, Readonly<Record<number, Pending>>>>()(() => ({}))
const keyOf = (r: Remove) => `${r.record}|${r.part ?? ''}`
const EMPTY: DoubtsDraft = { picked: {}, missing: '' }
export const MAX_MISSING = 200
/** The write key of one saved view's second save (writes.ts): its own lock and "on its way" state, apart from the view's. */
export const doubtsKey = (sid: string, view: number): string => `${sid}:doubts:${view}`

/** For specs, and when the person is forgotten (signout.ts). */
export function resetDoubts(): void { useDoubts.setState({}, true); usePending.setState({}, true) }

/** The links a member can name, each once: core's `model.holdable` in its own words, a drawn line's hover its line's title; on a core before
 *  `holdable`, the lines `links[].remove` offers, by their cards' headings, as before. Shared with the stance form (LinkStance.tsx). */
export function offeredOf(view: View, heading: (id: string) => string): { link: Remove; text: string; title: string }[] {
  const lines = view.model?.links ?? [], holdable = view.model?.holdable
  if (holdable != null) return holdable.filter((h, i, all) => all.findIndex((x) => keyOf(x.link) === keyOf(h.link)) === i)
    .map((h) => ({ link: h.link, text: h.text, title: lines.find((l) => l.holds != null && keyOf(l.holds) === keyOf(h.link))?.title ?? h.text }))
  return lines.filter((l, i, all) => l.remove != null && all.findIndex((x) => x.remove != null && keyOf(x.remove) === keyOf(l.remove!)) === i) // `!= null`: a core before `links[].remove` omits it (r5 fixtures), which offers no link to doubt
    .map((l) => ({ link: l.remove!, text: `${heading(l.from)} → ${heading(l.to)}`, title: l.title }))
}

/** Send what this member named with their new view's id; nothing when they named nothing. Then the draft goes. The view is saved by then,
 *  so a refusal here is said beside these fields (core's words) and never as the view's own failure: the view is not sent again. */
export async function sendDoubts(sid: string, view: number, stance: string | null = null): Promise<void> {
  const d = useDoubts.getState()[sid] ?? EMPTY
  const links = Object.values(d.picked), missing = d.missing.trim()
  if (links.length === 0 && missing === '' && stance === null) return
  // What was named belongs to this saved view now: it leaves the fields at once, so whatever is typed next is the next view's, and a retry
  // of this one never reads or clears it (Codex reply 021 #1).
  useDoubts.setState((s) => ({ ...s, [sid]: EMPTY }))
  await post(sid, view, { links, missing: missing === '' ? null : missing, stance })
}

/** One send of a saved view's second save, through the team's one write path (writes.ts): a send still on its way is not sent again, and a
 *  lost answer locks it. True when core saved it. */
async function post(sid: string, view: number, body: Pending['body']): Promise<boolean> {
  try {
    await runWrite(doubtsKey(sid, view), { op: false }, null, () => call<{ doubt: number }>('POST', `/api/scenarios/${encodeURIComponent(sid)}/views/${view}/doubts`, body))
    usePending.setState((s) => { const { [view]: _done, ...rest } = s[sid] ?? {}; return { ...s, [sid]: rest } })
    return true
  } catch (e) {
    // A lost answer may have been saved (reply 021 #3): said as such, and not offered again; anything else is core's refusal, said in its words.
    const uncertain = e instanceof TeamApiError && e.uncertain
    const error = uncertain ? DOUBTS_MAY_HAVE_SAVED : DOUBTS_FAILED(e instanceof TeamApiError ? e.message : 'That did not go through.')
    usePending.setState((s) => ({ ...s, [sid]: { ...(s[sid] ?? {}), [view]: { body, error, uncertain } } }))
    return false
  }
}

/** A retry of one saved view's second save: the same body, nothing else; once core saves it, the scenario is read again (reply 021 #2). */
export async function retryDoubts(sid: string, view: number, onWrote: () => Promise<boolean>): Promise<void> {
  const p = usePending.getState()[sid]?.[view]
  if (p === undefined || p.uncertain) return
  if (await post(sid, view, p.body)) await onWrote()
}

/** Said where the view's second save failed (core's words after the colon). The view itself is saved: never said as the view failing. */
export const DOUBTS_FAILED = (said: string): string => `Your view is saved; what you added with it was not: ${said}`
/** Said where the second save's answer was lost: it may have been saved, so it is not sent again (as writes.ts MAY_HAVE_SAVED). */
export const DOUBTS_MAY_HAVE_SAVED = 'Your view is saved. What you added with it may have been saved too: the connection dropped before Olumi answered. It is not sent again from this page: reload the page to see what Olumi holds.'
export const DOUBTS_RETRY = 'Try again'

/** Is any saved view's second save on its way for this scenario? The Views panel holds its form while one is (reply 021 #1). */
export const useDoubtsSending = (sid: string): boolean => useWrites((s) => Object.keys(s.sending).some((k) => k.startsWith(`${sid}:doubts:`)))

/**
 * Codex 17:35:59Z (UI half): the view's second save (its stance, links, factor) can fail after the view is saved. Its failure is said here,
 * drawn by the Views panel outside every model-gated field (before any approved model, the link and factor fields are not drawn, and the form
 * closes once the view is saved), with one retry that sends the same saved view's id and what was named, never the view's text again.
 */
export function DoubtsFailure({ sid, onWrote }: { sid: string; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const pending = usePending((s) => s[sid])
  const views = Object.keys(pending ?? {}).map(Number)
  if (pending === undefined || views.length === 0) return null
  return <>{views.map((v) => <Failure key={v} sid={sid} view={v} p={pending[v]!} onWrote={onWrote} />)}</>
}

function Failure({ sid, view, p, onWrote }: { sid: string; view: number; p: Pending; onWrote: () => Promise<boolean> }): JSX.Element {
  const sending = useWriteSending(doubtsKey(sid, view))
  return (
    <div className="grid gap-1.5" data-testid="team-view-doubts-failure" data-view={view}>
      <p role="alert" className={ERR} data-testid="team-view-doubts-error">{p.error}</p>
      {p.uncertain ? null : <div><Button size="sm" variant="secondary" data-testid="team-view-doubts-retry" disabled={sending}
        onClick={() => { void retryDoubts(sid, view, onWrote) }}>{DOUBTS_RETRY}</Button></div>}
    </div>
  )
}

export function ViewDoubts({ sid, view, disabled }: { sid: string; view: View; disabled: boolean }): JSX.Element | null {
  const d = useDoubts((s) => s[sid] ?? EMPTY)
  // Offered only on a core that has the debate routes: its differences read answered (DifferencesPanel reads it; a core without the route
  // answers 404 and leaves it null), so a member on an older core is never offered fields it would refuse after their view is saved.
  const supported = useDifferences((s) => s.sid === sid && s.data !== null)
  const cards = view.model?.cards ?? []
  const heading = (id: string) => cards.find((c) => c.id === id)?.heading ?? id
  // Only the approved version's links (a proposal on screen is not what a view is given against), each once. Core's `model.holdable` names
  // them in its own words (a link folded into a card, like the X2 morale link, is drawn nowhere else). A View from a core without it offers
  // `links[].remove`; one without either has none to offer (absent is not a link: `!= null`), and the panel still draws.
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  // One place at a time (DL 9 Nov, core's `collab.link_route`): once the View shows this member a reveal, a link is doubted or kept on the
  // shared card (LinkStance.tsx), so this list is not offered; the factor and the stance stay with the view.
  const links = shownIsProposal || view.collab.link_route === 'stance' ? [] : offeredOf(view, heading)
  if (!supported || view.version === null || shownIsProposal) return null
  const put = (p: Partial<DoubtsDraft>) => useDoubts.setState((s) => ({ ...s, [sid]: { ...(s[sid] ?? EMPTY), ...p } }))
  return (
    <div className="grid gap-1.5" data-testid="team-view-doubts">
      {links.length > 0 && (
        <fieldset className="m-0 grid gap-1 border-0 p-0">
          <legend className={LABEL}>Links you doubt (optional)</legend>
          {links.map((l) => {
            const k = keyOf(l.link), on = d.picked[k] !== undefined
            return (
              <label key={k} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2 break-words`} title={l.title}>
                <input type="checkbox" className="mt-1" data-testid={`team-view-doubt-${k}`} checked={on} disabled={disabled}
                  onChange={(e) => { const { [k]: _gone, ...rest } = d.picked; put({ picked: e.target.checked ? { ...rest, [k]: l.link } : rest, error: null }) }} />
                <span data-view="holdable.text">{l.text}</span>
              </label>
            )
          })}
        </fieldset>
      )}
      <label className={`${META} grid gap-1`}>
        <span className="font-medium text-text-header">A factor you think the model leaves out (optional)</span>
        <input type="text" autoComplete="off" maxLength={MAX_MISSING} data-testid="team-view-missing" className={FIELD} value={d.missing} disabled={disabled}
          onChange={(e) => put({ missing: e.target.value, error: null })} />
      </label>
    </div>
  )
}
