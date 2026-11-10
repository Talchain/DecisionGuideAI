/**
 * Which AI answers this scenario's steps (olumi-core profiles, 10 Nov): Olumi, Claude or ChatGPT, at the foot of the AI panel's composer.
 * Every word is core's (`GET /api/profiles` before a brief is sent, `GET …/profile` once the scenario exists), drawn verbatim. Before the
 * brief, the choice is held here and sent with it (`writes.create`); after, a choice is saved at once (`POST …/profile`) and applies to
 * the scenario's next AI step. The look is the Model tab's crafted pill pair (ViewModelTab ExpertSwitch): the chosen arm filled, arrow keys
 * along it, only the chosen arm in the tab order. Nothing here ranks or recommends one: the names only.
 */
import { create } from 'zustand'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { newOp, TeamApiError } from '../olumiCore/team/api'
import { profiles, type ProfileView } from './client'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'

interface ProfileState {
  /** Core's words and the profile in force, for `sid` (null: before a brief, the host's). */
  readonly view: ProfileView | null
  readonly sid: string | null
  /** Before a brief: the person's choice, sent with it. Null: the host's. */
  readonly chosen: string | null
  readonly saving: boolean
  /** Core's words when a choice did not go through. */
  readonly said: string | null
}
export const useViewProfile = create<ProfileState>()(() => ({ view: null, sid: null, chosen: null, saving: false, said: null }))

/** The profile a brief is sent under: the person's choice before it, else none (core then uses the host's). */
export const profileForBrief = (): string | null => useViewProfile.getState().chosen

/** Core's answer in the shape this page draws, or null (an older core without profiles answers another shape: nothing is drawn). */
const shaped = (x: unknown): ProfileView | null => {
  const v = x as Partial<ProfileView> | null
  return v !== null && typeof v === 'object' && typeof v.profile === 'string' && typeof v.heading === 'string' && Array.isArray(v.choices)
    && v.choices.every((c) => typeof c?.id === 'string' && typeof c?.label === 'string') ? v as ProfileView : null
}

async function load(sid: string | null): Promise<void> {
  try {
    const view = shaped(await (sid === null ? profiles.host() : profiles.read(sid)))
    if (useViewProfile.getState().sid === sid) useViewProfile.setState({ view })
  } catch { /* the selector is not drawn until core's words are read */ }
}

async function choose(sid: string | null, id: string): Promise<void> {
  const s = useViewProfile.getState()
  if (s.saving || s.view === null) return
  if (sid === null) { useViewProfile.setState({ chosen: id, view: { ...s.view, profile: id }, said: null }); return }
  useViewProfile.setState({ saving: true, said: null })
  try {
    const view = shaped(await profiles.set(sid, id, newOp()))
    if (view !== null && useViewProfile.getState().sid === sid) useViewProfile.setState({ view })
  } catch (e) {
    useViewProfile.setState({ said: e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was changed.' })
  } finally { useViewProfile.setState({ saving: false }) }
}

/** The selector, under the composer's box. `held`: a write is in flight (or a past version is drawn), so nothing is changed now. */
export function ViewProfile({ sid, held }: { sid: string | null; held: boolean }) {
  const { view, saving, said } = useViewProfile()
  const arms = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    // A scenario's own profile once it exists; before, the host's words and any choice already made for this brief.
    const was = useViewProfile.getState()
    if (was.sid !== sid) useViewProfile.setState({ sid, view: null, said: null, ...(sid === null ? {} : { chosen: null }) })
    void load(sid).then(() => {
      const now = useViewProfile.getState()
      if (sid === null && now.chosen !== null && now.view !== null) useViewProfile.setState({ view: { ...now.view, profile: now.chosen } })
    })
  }, [sid])
  if (view === null) return null
  const at = view.choices.findIndex((c) => c.id === view.profile)
  const off = held || saving
  const pick = (k: number) => { const c = view.choices[k]; if (c && !off) { void choose(sid, c.id); arms.current[k]?.focus() } }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(Math.min(view.choices.length - 1, at + 1)) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(Math.max(0, at - 1)) }
  }
  const arm = (on: boolean) => `${typography.viewPanelMeta} inline-flex h-7 items-center rounded-full px-2.5 transition-colors duration-fast ${ACTION_FOCUS} ${on
    ? 'bg-text-header text-text-on-color' : 'text-text-light hover:text-text-body'} disabled:cursor-not-allowed`
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="view-profile">
      <span id="view-profile-heading" className={`${typography.viewPanelMeta} text-text-light`} data-view="profile.heading">{view.heading}</span>
      <div role="radiogroup" aria-labelledby="view-profile-heading" onKeyDown={onKey}
        className="inline-flex flex-none items-center gap-0.5 rounded-full border border-panel-border bg-panel p-0.5">
        {view.choices.map((c, k) => (
          <button key={c.id} ref={(el) => { arms.current[k] = el }} type="button" role="radio" aria-checked={k === at} tabIndex={k === at ? 0 : -1}
            disabled={off} onClick={() => pick(k)} className={arm(k === at)} data-testid={`view-profile-${c.id}`} data-view={`profile.choices.${k}.label`}>
            {c.label}
          </button>
        ))}
      </div>
      {said === null ? null : <p role="alert" className={`${typography.viewPanelMeta} w-full text-text-body`} data-testid="view-profile-said">{said}</p>}
    </div>
  )
}
