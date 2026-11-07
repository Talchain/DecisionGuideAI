import { create } from 'zustand'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'
import { BODY, ERR, FIELD, LABEL, META } from './ui'
import { useDifferences } from './differences'

/**
 * A private view's links and factor (core `POST …/views/:id/doubts`, olumi-core wip/debate): the links of the model this member doubts (each
 * as the View offers it, `links[].remove`, sent verbatim) and a factor they think the model leaves out, in their own words. Private with the
 * view: core shows them only once the view is shown, and then runs the model with and without each doubted link ("Where your explanations
 * differ"). Held here until the view is given, then sent with its id; dropped with the view's draft.
 */
type Remove = NonNullable<NonNullable<View['model']>['links'][number]['remove']>
interface DoubtsDraft { readonly picked: Readonly<Record<string, Remove>>; readonly missing: string; readonly stance: string | null; readonly error?: string | null }
const useDoubts = create<Record<string, DoubtsDraft>>()(() => ({}))
const keyOf = (r: Remove) => `${r.record}|${r.part ?? ''}`
const EMPTY: DoubtsDraft = { picked: {}, missing: '', stance: null }
export const MAX_MISSING = 200

/** For specs. */
export function resetDoubts(): void { useDoubts.setState({}, true) }

/** Send what this member named with their new view's id; nothing when they named nothing. Then the draft goes. The view is saved by then,
 *  so a refusal here is said beside these fields (core's words) and never as the view's own failure: the view is not sent again. */
export async function sendDoubts(sid: string, view: number): Promise<void> {
  const d = useDoubts.getState()[sid] ?? EMPTY
  const links = Object.values(d.picked), missing = d.missing.trim(), stance = d.stance ?? null
  if (links.length === 0 && missing === '' && stance === null) return
  try {
    await call<{ doubt: number }>('POST', `/api/scenarios/${encodeURIComponent(sid)}/views/${view}/doubts`, { links, missing: missing === '' ? null : missing, stance })
    useDoubts.setState((s) => ({ ...s, [sid]: EMPTY }))
  } catch (e) {
    const said = e instanceof TeamApiError ? e.message : 'That did not go through.'
    useDoubts.setState((s) => ({ ...s, [sid]: { ...(s[sid] ?? EMPTY), error: `Your view is saved; the links and factor were not: ${said}` } }))
  }
}

export function ViewDoubts({ sid, view, disabled }: { sid: string; view: View; disabled: boolean }): JSX.Element | null {
  const d = useDoubts((s) => s[sid] ?? EMPTY)
  // Offered only on a core that has the debate routes: its differences read answered (DifferencesPanel reads it; a core without the route
  // answers 404 and leaves it null), so a member on an older core is never offered fields it would refuse after their view is saved.
  const supported = useDifferences((s) => s.sid === sid && s.data !== null)
  const stances = useDifferences((s) => (s.sid === sid ? s.data?.stances : undefined)) ?? []
  const cards = view.model?.cards ?? []
  const heading = (id: string) => cards.find((c) => c.id === id)?.heading ?? id
  // Only the approved version's links (a proposal on screen is not what a view is given against), each once. A View from a core
  // without `links[].remove` has none to offer (absent is not a link: `!= null`), and the panel still draws.
  const shownIsProposal = view.proposal !== null && view.model?.edit_base === null
  const links = shownIsProposal ? [] : (view.model?.links ?? []).filter((l, i, all) => l.remove != null && all.findIndex((x) => x.remove != null && keyOf(x.remove) === keyOf(l.remove!)) === i)
  if (!supported || view.version === null || shownIsProposal) return null
  const put = (p: Partial<DoubtsDraft>) => useDoubts.setState((s) => ({ ...s, [sid]: { ...(s[sid] ?? EMPTY), ...p } }))
  return (
    <div className="grid gap-1.5" data-testid="team-view-doubts">
      {links.length > 0 && (
        <fieldset className="m-0 grid gap-1 border-0 p-0">
          <legend className={LABEL}>Links you doubt (optional)</legend>
          {links.map((l) => {
            const k = keyOf(l.remove!), on = d.picked[k] !== undefined
            return (
              <label key={k} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2 break-words`} title={l.title}>
                <input type="checkbox" className="mt-1" data-testid={`team-view-doubt-${k}`} checked={on} disabled={disabled}
                  onChange={(e) => { const { [k]: _gone, ...rest } = d.picked; put({ picked: e.target.checked ? { ...rest, [k]: l.remove! } : rest, error: null }) }} />
                <span>{heading(l.from)} → {heading(l.to)}</span>
              </label>
            )
          })}
        </fieldset>
      )}
      <label className={`${META} grid gap-0.5`}>
        <span className="text-text-header">A factor you think the model leaves out (optional)</span>
        <input type="text" autoComplete="off" maxLength={MAX_MISSING} data-testid="team-view-missing" className={FIELD} value={d.missing} disabled={disabled}
          onChange={(e) => put({ missing: e.target.value, error: null })} />
      </label>
      {stances.length > 0 && (
        <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid="team-view-stance">
          <legend className={LABEL}>How you hold this view (optional)</legend>
          {stances.map((o) => (
            <label key={o.id} className={`${BODY} flex min-h-[28px] cursor-pointer items-start gap-2 break-words`}>
              <input type="radio" name={`team-view-stance-${sid}`} className="mt-1" data-testid={`team-view-stance-${o.id}`} checked={d.stance === o.id} disabled={disabled}
                onChange={() => put({ stance: o.id, error: null })} />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      )}
      {d.error ? <p role="alert" className={ERR} data-testid="team-view-doubts-error">{d.error}</p> : null}
    </div>
  )
}
