import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../../canvas/store'
import { clearAutosave, clearCurrentScenarioId } from '../../canvas/store/scenarios'
import { useViewStore } from '../../olumiView/store'
import { NOT_FOR_THIS_PAGE, TeamApiError } from '../team/api'
import { accountsApi, mine, SWITCHED, whenOf, type MyScenario } from './api'
import { BODY, CARD, ERR, FIELD, LINK, META, SignedInFrame, useWho } from './Frame'

/** Its address on this page: DGAI's scenario route (`/#/scenario/<uuid>`) as a route here; any other address as a plain link. */
function Open({ s }: { s: MyScenario }): JSX.Element {
  const cls = `${typography.h5} text-text-header hover:underline underline-offset-2`
  return s.open.startsWith('/#/') ? <Link to={s.open.slice(2)} className={cls} data-testid={`my-scenario-open-${s.id}`}>{s.label}</Link>
    : <a href={s.open} className={cls} data-testid={`my-scenario-open-${s.id}`}>{s.label}</a>
}

/**
 * "New scenario": the canvas forgets the scenario it showed last, so `/canvas` opens on a blank brief rather than restoring it (measured on
 * a local core: without this, New scenario reopened the last scenario). The store's own "Start fresh" (`resetCanvas`) does it for a
 * canvas with a model in memory; it returns early on an empty one, so the remembered id and autosave are cleared here too.
 */
export function startFreshScenario(): void {
  useCanvasStore.getState().resetCanvas()
  clearCurrentScenarioId()
  clearAutosave()
  useCanvasStore.setState({ currentScenarioId: null, scenarioPersistedToDb: false })
  void useViewStore.getState().use(null)
}

/**
 * MY SCENARIOS, the lane's home (core `GET /api/account/scenarios`): every scenario this person can open, most recent first, with the
 * version its model is at, when anything last happened and who is on it. Opening one goes to the scenario as it stands now, where the
 * team left it; "New scenario" starts one from a brief. "Archive" puts one away in this person's list only (everyone else on it still
 * sees it); the archived ones are listed apart, each with "Restore". "Rename" gives it this person's own title, which only they see.
 * "Delete" removes for good a scenario only they are on, once they type its title; with anyone else on it core refuses and says to archive it.
 * "Duplicate" makes their own copy of its latest saved version: only they are on it, and each figure keeps the person who wrote it.
 */
export default function MyScenariosPage(): JSX.Element {
  const who = useWho()
  const navigate = useNavigate()
  const [list, setList] = useState<readonly MyScenario[] | null>(null)
  const [away, setAway] = useState<readonly MyScenario[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const page = who.status === 'in' ? who.me.id : null
  /** Reads the list for this page's person; `live` says whether the answer may still be shown. */
  const load = useCallback(async (live: () => boolean) => {
    if (page === null) return
    try {
      const r = await accountsApi.scenarios()
      mine(r, r?.you_id, page)
      if (live()) { setList(Array.isArray(r?.scenarios) ? r.scenarios : []); setAway(Array.isArray(r?.archived) ? r.archived : []) }
    } catch (e) { if (live()) { setList(null); setAway([]); setError(e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.') } }
  }, [page])
  useEffect(() => {
    let live = true
    void load(() => live)
    return () => { live = false }
  }, [load])
  /** After a refused save: a refusal because this browser is now someone else's (409) clears everything of this page's person, and the
   *  edit; any other refusal keeps the list and what was typed, so the person can correct it. */
  const refused = async (e: unknown) => {
    if (!(e instanceof TeamApiError) || (e.message !== NOT_FOR_THIS_PAGE && e.message !== SWITCHED)) return
    setList(null); setAway([]); setEditing(null); setCopied(null); setDeleting(null)
  }
  /** The scenario whose title is being edited, and what the person has typed. */
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)
  const saveTitle = async (e: FormEvent) => {
    e.preventDefault()
    if (editing === null) return
    setBusy(editing.id); setError(null)
    try { await accountsApi.retitle(editing.id, editing.title); setEditing(null); await load(() => true) }
    catch (err) { setError(err instanceof TeamApiError ? err.message : 'Olumi could not save that just now. Try again in a moment.'); await refused(err) }
    finally { setBusy(null) }
  }
  /** The copy just made, said once above the list. */
  const [copied, setCopied] = useState<{ title: string; n: number } | null>(null)
  /** One operation id per Duplicate a person starts, kept until core answers it: a try after a lost answer sends the same id, so core
   *  answers with the copy it already made. After any failure the list is read again, so a copy that did land is on screen. */
  const ops = useRef(new Map<string, string>())
  const duplicate = async (id: string) => {
    setBusy(id); setError(null); setCopied(null)
    const op = ops.current.get(id) ?? crypto.randomUUID()
    ops.current.set(id, op)
    try { const r = await accountsApi.duplicate(id, op); ops.current.delete(id); await load(() => true); setCopied({ title: r.title, n: r.n }) }
    catch (e) {
      const said = e instanceof TeamApiError ? e.message : 'Olumi could not save that just now. Try again in a moment.'
      if (e instanceof TeamApiError && !e.uncertain && e.status < 500) ops.current.delete(id) // core refused it: nothing was made
      await refused(e)
      if (!(e instanceof TeamApiError) || (e.message !== NOT_FOR_THIS_PAGE && e.message !== SWITCHED)) await load(() => true)
      setError(said)
    }
    finally { setBusy(null) }
  }
  /** The scenario being deleted, and the title typed so far to confirm it. */
  const [deleting, setDeleting] = useState<{ id: string; typed: string } | null>(null)
  const deleteIt = async (e: FormEvent, s: MyScenario) => {
    e.preventDefault()
    if (deleting === null || deleting.typed.trim() !== s.title.trim()) return
    setBusy(s.id); setError(null); setCopied(null)
    try { await accountsApi.deleteScenario(s.id, deleting.typed.trim()); setDeleting(null); await load(() => true) }
    catch (err) { setError(err instanceof TeamApiError ? err.message : 'Olumi could not save that just now. Try again in a moment.'); await refused(err) }
    finally { setBusy(null) }
  }
  const setArchived = async (id: string, archived: boolean) => {
    setBusy(id); setError(null)
    try { await accountsApi.archive(id, archived); await load(() => true) }
    catch (e) { setError(e instanceof TeamApiError ? e.message : 'Olumi could not save that just now. Try again in a moment.'); await refused(e) }
    finally { setBusy(null) }
  }
  return (
    <SignedInFrame who={who} title="My scenarios" testid="account-home" action={<Button onClick={() => { startFreshScenario(); navigate('/canvas') }} data-testid="my-scenarios-new">New scenario</Button>}>
      {(w) => (
        <>
          {!w.account && (
            <p className={`${CARD} ${BODY}`} data-testid="my-scenarios-no-account">
              You are signed in with a private link. <Link to="/signup" className={LINK}>Add an email and password</Link> to sign in from any browser and invite colleagues.
            </p>
          )}
          {error && <p role="alert" className={ERR}>{error}</p>}
          {copied && list !== null && (
            <p role="status" className={`${CARD} ${BODY}`} data-testid="my-scenarios-duplicated">“{copied.title}” is your own copy of version {copied.n}. Only you are on it, and each figure keeps the person who wrote it.</p>
          )}
          {list === null && !error && <p className={BODY}>Loading your scenarios…</p>}
          {list !== null && list.length === 0 && away.length > 0 && (
            <p className={`${CARD} ${BODY}`} data-testid="my-scenarios-all-archived">Every scenario you are on is archived. Restore one below to see it here again.</p>
          )}
          {list !== null && list.length === 0 && away.length === 0 && (
            <div className={`${CARD} grid gap-2`} data-testid="my-scenarios-empty">
              <p className={`${typography.h5} text-text-header m-0`}>No scenarios yet</p>
              <p className={BODY}>Start one by writing a brief: the question you are working on, in your own words. Olumi builds a model from it for you to shape.</p>
            </div>
          )}
          {list !== null && list.length > 0 && (
            <ul className="m-0 grid list-none gap-3 p-0" data-testid="my-scenarios">
              {list.map((s) => (
                <li key={s.id} className={`${CARD} grid gap-1.5`} data-testid={`my-scenario-${s.id}`}>
                  <Open s={s} />
                  <p className={META}>
                    {s.version === null ? 'No saved model yet' : `Version ${s.version}`}
                    {s.last_activity && <> · Last activity {whenOf(s.last_activity)}</>}
                    {s.your_last && <> · You were last active {whenOf(s.your_last)}</>}
                  </p>
                  <p className={`${typography.bodySmall} text-text-body m-0`}>On it: {s.members.map((m) => m.name).join(', ') || 'no one else yet'}</p>
                  {editing?.id === s.id ? (
                    <form className="grid gap-2" onSubmit={(e) => void saveTitle(e)} data-testid={`my-scenario-title-form-${s.id}`}>
                      <label className="grid gap-1">
                        <span className={META}>Your title for this scenario</span>
                        <input className={FIELD} value={editing.title} maxLength={200} autoFocus onChange={(e) => setEditing({ id: s.id, title: e.target.value })} />
                      </label>
                      <p className={META}>Only you see this title. Everyone else on it keeps theirs. Leave it empty to use the scenario's own.</p>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={busy !== null} data-testid={`my-scenario-title-save-${s.id}`}>Save title</Button>
                        <button type="button" className={LINK} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : deleting?.id === s.id ? (
                    <form className="grid gap-2" onSubmit={(e) => void deleteIt(e, s)} data-testid={`my-scenario-delete-form-${s.id}`}>
                      <p className={BODY}>This deletes “{s.title}” and everything in it. It cannot be undone.</p>
                      <label className="grid gap-1">
                        <span className={META}>Type the title to delete it</span>
                        <input className={FIELD} value={deleting.typed} autoFocus onChange={(e) => setDeleting({ id: s.id, typed: e.target.value })} />
                      </label>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={busy !== null || deleting.typed.trim() !== s.title.trim()} data-testid={`my-scenario-delete-go-${s.id}`}>Delete this scenario</Button>
                        <button type="button" className={LINK} onClick={() => setDeleting(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex gap-4">
                      <button type="button" className={LINK} disabled={busy !== null} onClick={() => setEditing({ id: s.id, title: s.title })} data-testid={`my-scenario-rename-${s.id}`}>Rename</button>
                      {s.version !== null && <button type="button" className={LINK} disabled={busy !== null} onClick={() => void duplicate(s.id)} data-testid={`my-scenario-duplicate-${s.id}`}>Duplicate</button>}
                      <button type="button" className={LINK} disabled={busy !== null} onClick={() => void setArchived(s.id, true)} data-testid={`my-scenario-archive-${s.id}`}>Archive</button>
                      <button type="button" className={LINK} disabled={busy !== null} onClick={() => setDeleting({ id: s.id, typed: '' })} data-testid={`my-scenario-delete-${s.id}`}>Delete</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {away.length > 0 && (
            <details className={`${CARD} grid gap-2`} data-testid="my-scenarios-archived">
              <summary className={`${typography.label} text-text-header cursor-pointer`}>Archived ({away.length})</summary>
              <p className={META}>Archived scenarios are hidden from your list only. Everyone else on them still sees them, and nothing in them changes.</p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {away.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-3" data-testid={`my-archived-${s.id}`}>
                    <Open s={s} />
                    <button type="button" className={LINK} disabled={busy !== null} onClick={() => void setArchived(s.id, false)} data-testid={`my-scenario-restore-${s.id}`}>Restore</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </SignedInFrame>
  )
}
